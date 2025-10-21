import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { createServiceClient } from "@/lib/supabase/server";
import { STRIPE_CONFIG } from "@/lib/stripe/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No signature provided" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFinalized(supabase, invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, session);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleSubscriptionUpdate(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const organizationId = subscription.metadata.organization_id;

  if (!organizationId) {
    console.error("No organization_id in subscription metadata");
    return;
  }

  // Calculate seat count from subscription items
  const perSeatItem = subscription.items.data.find(
    (item) => item.price.id === STRIPE_CONFIG.perSeatPriceId
  );
  const seatCount = perSeatItem ? perSeatItem.quantity || 0 : 0;

  // Determine subscription plan from base price
  const baseItem = subscription.items.data.find(
    (item) =>
      item.price.id !== STRIPE_CONFIG.perSeatPriceId &&
      item.price.id !== STRIPE_CONFIG.meteredUsagePriceId
  );

  let subscriptionPlan = null;
  if (baseItem) {
    const planKey = Object.keys(STRIPE_CONFIG.plans).find(
      (key) =>
        STRIPE_CONFIG.plans[key as keyof typeof STRIPE_CONFIG.plans].priceId ===
        baseItem.price.id
    );
    subscriptionPlan = planKey || null;
  }

  await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_plan: subscriptionPlan,
      seat_count: seatCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);
}

async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const organizationId = subscription.metadata.organization_id;

  if (!organizationId) {
    console.error("No organization_id in subscription metadata");
    return;
  }

  await supabase
    .from("organizations")
    .update({
      stripe_subscription_id: null,
      subscription_status: "canceled",
      subscription_plan: null,
      seat_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);
}

async function handleInvoiceFinalized(supabase: any, invoice: Stripe.Invoice) {
  // Handle invoice finalized logic here
  // You might want to send notifications, update billing status, etc.
  console.log("Invoice finalized:", invoice.id);
}

async function handleInvoicePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const organizationId = invoice.metadata?.organization_id;

  if (!organizationId) {
    console.error("No organization_id in invoice metadata");
    return;
  }

  // Update organization status to indicate payment issues
  await supabase
    .from("organizations")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  // You might want to send notifications to the organization owners here
  console.log("Payment failed for organization:", organizationId);
}

async function handleCheckoutCompleted(
  supabase: any,
  session: Stripe.Checkout.Session
) {
  const organizationId = session.metadata?.organization_id;

  if (!organizationId) {
    console.error("No organization_id in session metadata");
    return;
  }

  // The subscription will be handled by the subscription.created/updated webhooks
  // This webhook is mainly for logging and any additional setup
  console.log("Checkout completed for organization:", organizationId);
}
