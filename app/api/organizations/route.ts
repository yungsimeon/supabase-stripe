import { NextRequest, NextResponse } from "next/server";
import { requireUser, getUserOrganizations } from "@/lib/auth/helpers";
import { createStripeCustomer } from "@/lib/stripe/billing";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireUser();
    const organizations = await getUserOrganizations(user.id);

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { name, slug } = await request.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check if slug is already taken
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization slug already exists" },
        { status: 400 }
      );
    }

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name,
        slug,
      })
      .select()
      .single();

    if (orgError) {
      throw orgError;
    }

    // Create Stripe customer
    const stripeCustomer = await createStripeCustomer(organization, user.email);

    // Update organization with Stripe customer ID
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: stripeCustomer.id })
      .eq("id", organization.id);

    // Add user as owner
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: "owner",
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      throw memberError;
    }

    return NextResponse.json({
      organization: {
        ...organization,
        stripe_customer_id: stripeCustomer.id,
      },
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
}
