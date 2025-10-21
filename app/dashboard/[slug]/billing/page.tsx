"use client";

import { useState, useEffect } from "react";
import { requireOrganizationAccess } from "@/lib/auth/helpers";
import { getStripe } from "@/lib/stripe/client";
import { STRIPE_CONFIG } from "@/lib/stripe/server";

interface Organization {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  seat_count: number;
}

interface BillingPageProps {
  params: Promise<{ slug: string }>;
}

export default function BillingPage({ params }: BillingPageProps) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const loadOrganization = async () => {
      const { slug } = await params;
      // In a real app, you'd fetch this from an API route
      // For now, we'll simulate the organization data
      setOrganization({
        id: "org-123",
        name: "Example Organization",
        slug: slug,
        stripe_customer_id: "cus_example",
        stripe_subscription_id: "sub_example",
        subscription_status: "active",
        subscription_plan: "pro",
        seat_count: 5,
      });
      setLoading(false);
    };
    loadOrganization();
  }, [params]);

  const handleUpgrade = async (planKey: string) => {
    if (!organization) return;

    setActionLoading(planKey);
    try {
      const response = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: organization.id,
          priceId:
            STRIPE_CONFIG.plans[planKey as keyof typeof STRIPE_CONFIG.plans]
              .priceId,
        }),
      });

      const { sessionId } = await response.json();
      const stripe = await getStripe();

      if (stripe) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error("Stripe checkout error:", error);
        }
      }
    } catch (error) {
      console.error("Error upgrading plan:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!organization) return;

    setActionLoading("portal");
    try {
      const response = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: organization.id,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error("Error opening billing portal:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!organization) {
    return <div>Organization not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Billing & Subscription
        </h1>
        <p className="text-gray-600">
          Manage your subscription, billing, and payment methods.
        </p>
      </div>

      {/* Current Subscription */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Current Subscription
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Plan</p>
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {organization.subscription_plan || "No plan"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="text-lg font-semibold text-gray-900 capitalize">
              {organization.subscription_status || "Inactive"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Seats</p>
            <p className="text-lg font-semibold text-gray-900">
              {organization.seat_count}
            </p>
          </div>
        </div>

        {organization.stripe_customer_id && (
          <div className="mt-4">
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === "portal"}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {actionLoading === "portal" ? "Loading..." : "Manage Billing"}
            </button>
          </div>
        )}
      </div>

      {/* Available Plans */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.entries(STRIPE_CONFIG.plans).map(([key, plan]) => (
            <div
              key={key}
              className={`border rounded-lg p-6 ${
                organization.subscription_plan === key
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200"
              }`}
            >
              <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${plan.price}
                <span className="text-sm font-normal text-gray-500">
                  /month
                </span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-center text-sm text-gray-600"
                  >
                    <span className="text-green-500 mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(key)}
                disabled={
                  actionLoading === key ||
                  organization.subscription_plan === key
                }
                className={`w-full mt-6 py-2 px-4 rounded-md text-sm font-medium ${
                  organization.subscription_plan === key
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                }`}
              >
                {actionLoading === key
                  ? "Processing..."
                  : organization.subscription_plan === key
                  ? "Current Plan"
                  : "Upgrade"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Information */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Usage & Billing
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Per-seat billing</p>
            <p className="text-sm text-gray-900">
              You are billed for each active member in your organization.
              Current seat count: {organization.seat_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Metered usage</p>
            <p className="text-sm text-gray-900">
              API calls and other usage-based features are billed separately
              based on your actual usage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
