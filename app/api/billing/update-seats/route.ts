import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/helpers";
import { updateSubscriptionSeats } from "@/lib/stripe/billing";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, seatCount } = await request.json();

    if (!organizationId || seatCount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (seatCount < 0) {
      return NextResponse.json(
        { error: "Seat count must be non-negative" },
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { organization, userRole } = await requireOrganizationAccess(
      organizationId,
      "admin"
    );

    if (!organization.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    await updateSubscriptionSeats(
      organization.stripe_subscription_id,
      seatCount
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating seats:", error);
    return NextResponse.json(
      { error: "Failed to update seats" },
      { status: 500 }
    );
  }
}
