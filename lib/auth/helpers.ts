import { createClient } from "@/lib/supabase/server";
import { Database } from "@/lib/database/types";
import { redirect } from "next/navigation";

export type User = {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
};

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMember =
  Database["public"]["Tables"]["organization_members"]["Row"];

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email!,
    user_metadata: user.user_metadata,
  };
}

export async function requireUser(): Promise<User> {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function getUserOrganizations(userId: string): Promise<
  Array<{
    organization: Organization;
    role: OrganizationMember["role"];
  }>
> {
  const supabase = await createClient();

  // Use a more direct query to avoid RLS recursion
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      role,
      organization_id,
      organizations!inner (
        id,
        name,
        slug,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        subscription_plan,
        seat_count,
        created_at,
        updated_at
      )
    `
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch user organizations: ${error.message}`);
  }

  return data.map((item: any) => ({
    organization: item.organizations,
    role: item.role,
  }));
}

export async function getOrganization(
  organizationId: string
): Promise<Organization | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function requireOrganizationAccess(
  organizationIdOrSlug: string,
  userRole?: OrganizationMember["role"]
): Promise<{
  user: User;
  organization: Organization;
  userRole: OrganizationMember["role"];
}> {
  const user = await requireUser();
  const supabase = await createClient();

  // Determine if we're looking up by ID (UUID format) or slug
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      organizationIdOrSlug
    );

  // Get organization and membership in one query to avoid RLS issues
  const query = supabase
    .from("organization_members")
    .select(
      `
      role,
      organization_id,
      organizations!inner (
        id,
        name,
        slug,
        stripe_customer_id,
        stripe_subscription_id,
        subscription_status,
        subscription_plan,
        seat_count,
        created_at,
        updated_at
      )
    `
    )
    .eq("user_id", user.id);

  // Filter by either organization_id or slug
  if (isUuid) {
    query.eq("organization_id", organizationIdOrSlug);
  } else {
    query.eq("organizations.slug", organizationIdOrSlug);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    redirect("/dashboard");
  }

  // Check role requirements if specified
  if (userRole && !hasRequiredRole(data.role, userRole)) {
    redirect("/dashboard");
  }

  return {
    user,
    organization: data.organizations,
    userRole: data.role,
  };
}

export function hasRequiredRole(
  userRole: OrganizationMember["role"],
  requiredRole: OrganizationMember["role"]
): boolean {
  const roleHierarchy = {
    member: 0,
    admin: 1,
    owner: 2,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export async function getOrganizationMembers(organizationId: string): Promise<
  Array<{
    id: string;
    email: string;
    role: OrganizationMember["role"];
    joined_at: string;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      role,
      joined_at,
      user_id,
      auth.users!inner(email)
    `
    )
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(`Failed to fetch organization members: ${error.message}`);
  }

  return data.map((item: any) => ({
    id: item.user_id,
    email: item.auth.users.email,
    role: item.role,
    joined_at: item.joined_at,
  }));
}
