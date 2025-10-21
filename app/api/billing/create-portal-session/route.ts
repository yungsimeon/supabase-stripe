import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/helpers";
import { createCustomerPortalSession } from "@/lib/stripe/billing";

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await request.json();

    if (!organizationId) {
      return NextResponse.json(
        { error: "Missing organization ID" },
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { organization, userRole } = await requireOrganizationAccess(
      organizationId,
      "admin"
    );

    if (!organization.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for organization" },
        { status: 400 }
      );
    }

    const session = await createCustomerPortalSession(
      organization.stripe_customer_id,
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
