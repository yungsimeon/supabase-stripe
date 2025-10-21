import { NextRequest, NextResponse } from "next/server";
import {
  requireOrganizationAccess,
  getOrganizationMembers,
} from "@/lib/auth/helpers";
import { createServiceClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { organization } = await requireOrganizationAccess(id);
    const members = await getOrganizationMembers(organization.id);

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, organization, userRole } = await requireOrganizationAccess(
      id,
      "admin"
    );

    const { email, role = "member" } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers({
      filter: { email: email },
    });

    if (existingUser.users && existingUser.users.length > 0) {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("user_id", existingUser.users[0].id)
        .single();

      if (existingMember) {
        return NextResponse.json(
          { error: "User is already a member" },
          { status: 400 }
        );
      }

      // Add existing user as member
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organization.id,
          user_id: existingUser.users[0].id,
          role,
          invited_by: user.id,
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        throw memberError;
      }

      return NextResponse.json({ success: true });
    } else {
      // Create invite for new user
      const token = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const { error: inviteError } = await supabase
        .from("organization_invites")
        .insert({
          organization_id: organization.id,
          email,
          role,
          invited_by: user.id,
          token,
          expires_at: expiresAt.toISOString(),
        });

      if (inviteError) {
        throw inviteError;
      }

      // TODO: Send invitation email here
      console.log(`Invitation sent to ${email} with token: ${token}`);

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Error adding member:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 }
    );
  }
}
