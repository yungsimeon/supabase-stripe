import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/helpers";
import { createCheckoutSession } from "@/lib/stripe/billing";
import { STRIPE_CONFIG } from "@/lib/stripe/server";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, priceId, isPerSeat, seatCount } =
      await request.json();

    if (!organizationId || !priceId) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    const session = await createCheckoutSession({
      organizationId,
      priceId,
      customerId: organization.stripe_customer_id,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
      isPerSeat,
      seatCount: seatCount || 1,
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
