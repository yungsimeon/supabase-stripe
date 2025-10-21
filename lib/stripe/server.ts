import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-09-30.clover",
  typescript: true,
});

export const STRIPE_CONFIG = {
  // Base subscription plans
  plans: {
    starter: {
      priceId: process.env.STRIPE_STARTER_PRICE_ID!,
      name: "Starter",
      price: 29,
      features: ["Up to 5 team members", "Basic support", "Standard features"],
    },
    pro: {
      priceId: process.env.STRIPE_PRO_PRICE_ID!,
      name: "Pro",
      price: 99,
      features: [
        "Up to 25 team members",
        "Priority support",
        "Advanced features",
      ],
    },
    enterprise: {
      priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
      name: "Enterprise",
      price: 299,
      features: ["Unlimited team members", "24/7 support", "All features"],
    },
  },
  // Per-seat add-on
  perSeatPriceId: process.env.STRIPE_PER_SEAT_PRICE_ID!,
  // Metered usage dimension
  meteredUsagePriceId: process.env.STRIPE_METERED_USAGE_PRICE_ID!,
  // Webhook events to handle
  webhookEvents: [
    "customer.subscription.updated",
    "invoice.finalized",
    "invoice.payment_failed",
    "checkout.session.completed",
    "customer.subscription.deleted",
    "customer.subscription.created",
  ],
} as const;
