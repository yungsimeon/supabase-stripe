import { NextRequest, NextResponse } from "next/server";
import { requireOrganizationAccess } from "@/lib/auth/helpers";
import { reportUsage } from "@/lib/stripe/billing";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { organizationId, dimension, quantity, timestamp } =
      await request.json();

    if (!organizationId || !dimension || quantity === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: "Quantity must be non-negative" },
        { status: 400 }
      );
    }

    // Verify user has access to the organization
    const { organization } = await requireOrganizationAccess(organizationId);

    if (!organization.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // Report usage to Stripe
    const usageRecord = await reportUsage(
      organization.stripe_subscription_id,
      quantity,
      timestamp ? new Date(timestamp) : undefined
    );

    // Store usage record in database for tracking
    const supabase = await createServiceClient();
    await supabase.from("usage_records").insert({
      organization_id: organizationId,
      dimension,
      quantity,
      timestamp: timestamp || new Date().toISOString(),
      stripe_usage_record_id: usageRecord.id,
    });

    return NextResponse.json({
      success: true,
      usageRecordId: usageRecord.id,
    });
  } catch (error) {
    console.error("Error reporting usage:", error);
    return NextResponse.json(
      { error: "Failed to report usage" },
      { status: 500 }
    );
  }
}
