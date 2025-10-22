"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface BillingInsightsProps {
  organizationId: string;
}

interface BillingData {
  organization: any;
  stripeCustomer: any;
  stripeSubscription: any;
  recentInvoices: any[];
  usageRecords: any[];
  totalUsage: number;
  estimatedCost: number;
}

export default function BillingInsights({
  organizationId,
}: BillingInsightsProps) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);

        // Fetch organization data
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", organizationId)
          .single();

        if (orgError) throw orgError;

        // Fetch usage records for this organization
        const { data: usage, error: usageError } = await supabase
          .from("usage_records")
          .select("*")
          .eq("organization_id", organizationId)
          .order("timestamp", { ascending: false });

        if (usageError) throw usageError;

        const totalUsage = usage.reduce(
          (sum, record) => sum + record.quantity,
          0
        );

        // Calculate estimated cost based on usage
        const estimatedCost = totalUsage * 0.001; // $0.001 per unit

        setData({
          organization: org,
          stripeCustomer: null, // Would fetch from Stripe API
          stripeSubscription: null, // Would fetch from Stripe API
          recentInvoices: [], // Would fetch from Stripe API
          usageRecords: usage,
          totalUsage,
          estimatedCost,
        });
      } catch (err) {
        console.error("Error fetching billing data:", err);
        setError("Failed to load billing data");
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchBillingData();
    }
  }, [organizationId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Organization Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Billing Overview - {data.organization.name}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800">Plan</h4>
            <p className="text-xl font-bold text-blue-900 capitalize">
              {data.organization.subscription_plan}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-800">Status</h4>
            <p className="text-xl font-bold text-green-900 capitalize">
              {data.organization.subscription_status}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-purple-800">Seats</h4>
            <p className="text-xl font-bold text-purple-900">
              {data.organization.seat_count}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-800">Total Usage</h4>
            <p className="text-xl font-bold text-orange-900">
              {data.totalUsage.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Usage Breakdown */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Usage Breakdown
        </h3>
        <div className="space-y-3">
          {Object.entries(
            data.usageRecords.reduce((acc, record) => {
              acc[record.dimension] =
                (acc[record.dimension] || 0) + record.quantity;
              return acc;
            }, {} as Record<string, number>)
          ).map(([dimension, quantity]: [string, unknown]) => (
            <div
              key={dimension}
              className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
            >
              <span className="text-sm font-medium text-gray-700 capitalize">
                {dimension.replace(/_/g, " ")}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {(quantity as number).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost Estimation */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Cost Estimation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-800">
              Estimated Cost
            </h4>
            <p className="text-2xl font-bold text-green-900">
              ${data.estimatedCost.toFixed(2)}
            </p>
            <p className="text-xs text-green-600 mt-1">
              Based on usage-based pricing
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800">Base Plan</h4>
            <p className="text-2xl font-bold text-blue-900">
              $
              {data.organization.subscription_plan === "enterprise"
                ? "299"
                : data.organization.subscription_plan === "pro"
                ? "99"
                : "29"}
            </p>
            <p className="text-xs text-blue-600 mt-1">Monthly subscription</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-purple-800">
              Total Estimated
            </h4>
            <p className="text-2xl font-bold text-purple-900">
              $
              {(
                data.estimatedCost +
                (data.organization.subscription_plan === "enterprise"
                  ? 299
                  : data.organization.subscription_plan === "pro"
                  ? 99
                  : 29)
              ).toFixed(2)}
            </p>
            <p className="text-xs text-purple-600 mt-1">Base + usage costs</p>
          </div>
        </div>
      </div>

      {/* Recent Usage Activity */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Usage Activity
        </h3>
        <div className="space-y-3">
          {data.usageRecords.slice(0, 5).map((record) => (
            <div
              key={record.id}
              className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
            >
              <div>
                <span className="text-sm font-medium text-gray-900 capitalize">
                  {record.dimension.replace(/_/g, " ")}
                </span>
                <div className="text-xs text-gray-500">
                  {new Date(record.timestamp).toLocaleString()}
                </div>
              </div>
              <span className="text-sm font-bold text-gray-900">
                +{record.quantity.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stripe Integration Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Stripe Integration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-800">Customer ID</h4>
            <p className="text-sm font-mono text-gray-600">
              {data.organization.stripe_customer_id || "Not connected"}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-800">
              Subscription ID
            </h4>
            <p className="text-sm font-mono text-gray-600">
              {data.organization.stripe_subscription_id || "Not connected"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
