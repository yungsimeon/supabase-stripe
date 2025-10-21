import { stripe, STRIPE_CONFIG } from "./server";
import { createServiceClient } from "@/lib/supabase/server";
import { Database } from "@/lib/database/types";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export async function createStripeCustomer(
  organization: Organization,
  email: string
) {
  const customer = await stripe.customers.create({
    email,
    name: organization.name,
    metadata: {
      organization_id: organization.id,
    },
  });

  return customer;
}

export async function createCheckoutSession({
  organizationId,
  priceId,
  successUrl,
  cancelUrl,
  customerId,
  isPerSeat = false,
  seatCount = 1,
}: {
  organizationId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId: string;
  isPerSeat?: boolean;
  seatCount?: number;
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: isPerSeat ? seatCount : 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organization_id: organizationId,
    },
    subscription_data: {
      metadata: {
        organization_id: organizationId,
      },
    },
  });

  return session;
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function updateSubscriptionSeats(
  subscriptionId: string,
  seatCount: number
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Find the per-seat line item
  const perSeatItem = subscription.items.data.find(
    (item) => item.price.id === STRIPE_CONFIG.perSeatPriceId
  );

  if (perSeatItem) {
    // Update existing per-seat item
    await stripe.subscriptionItems.update(perSeatItem.id, {
      quantity: seatCount,
    });
  } else {
    // Add new per-seat item
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        ...subscription.items.data.map((item) => ({
          id: item.id,
          price: item.price.id,
          quantity: item.quantity,
        })),
        {
          price: STRIPE_CONFIG.perSeatPriceId,
          quantity: seatCount,
        },
      ],
    });
  }
}

export async function reportUsage(
  subscriptionId: string,
  quantity: number,
  timestamp?: Date
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Find the metered usage line item
  const meteredItem = subscription.items.data.find(
    (item) => item.price.id === STRIPE_CONFIG.meteredUsagePriceId
  );

  if (!meteredItem) {
    throw new Error("Metered usage price not found in subscription");
  }

  const usageRecord = await stripe.subscriptionItems.createUsageRecord(
    meteredItem.id,
    {
      quantity,
      timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
      action: "increment",
    }
  );

  return usageRecord;
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
) {
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

export async function reactivateSubscription(subscriptionId: string) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}
