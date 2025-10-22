"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UsageRecord {
  id: string;
  organization_id: string;
  dimension: string;
  quantity: number;
  timestamp: string;
  stripe_usage_record_id: string | null;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_status: string;
  subscription_plan: string;
  seat_count: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

interface AnalyticsData {
  organizations: Organization[];
  usageRecords: UsageRecord[];
  totalUsage: number;
  usageByDimension: Record<string, number>;
  usageByOrganization: Record<string, number>;
  subscriptionStats: {
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
  };
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);

        // Fetch organizations
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .order("created_at", { ascending: false });

        if (orgError) throw orgError;

        // Fetch usage records
        const { data: usage, error: usageError } = await supabase
          .from("usage_records")
          .select("*")
          .order("timestamp", { ascending: false });

        if (usageError) throw usageError;

        // Calculate analytics
        const totalUsage = usage.reduce(
          (sum, record) => sum + record.quantity,
          0
        );

        const usageByDimension = usage.reduce((acc, record) => {
          acc[record.dimension] =
            (acc[record.dimension] || 0) + record.quantity;
          return acc;
        }, {} as Record<string, number>);

        const usageByOrganization = usage.reduce((acc, record) => {
          const org = orgs.find((o) => o.id === record.organization_id);
          const orgName = org?.name || "Unknown";
          acc[orgName] = (acc[orgName] || 0) + record.quantity;
          return acc;
        }, {} as Record<string, number>);

        const subscriptionStats = orgs.reduce(
          (acc, org) => {
            acc[org.subscription_status as keyof typeof acc]++;
            return acc;
          },
          {
            active: 0,
            trialing: 0,
            past_due: 0,
            canceled: 0,
          }
        );

        setData({
          organizations: orgs,
          usageRecords: usage,
          totalUsage,
          usageByDimension,
          usageByOrganization,
          subscriptionStats,
        });
      } catch (err) {
        console.error("Error fetching analytics data:", err);
        setError("Failed to load analytics data");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [supabase]);

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
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Analytics Dashboard
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800">
              Total Organizations
            </h3>
            <p className="text-2xl font-bold text-blue-900">
              {data.organizations.length}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-800">Total Usage</h3>
            <p className="text-2xl font-bold text-green-900">
              {data.totalUsage.toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-800">
              Active Subscriptions
            </h3>
            <p className="text-2xl font-bold text-purple-900">
              {data.subscriptionStats.active}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-orange-800">
              Trial Subscriptions
            </h3>
            <p className="text-2xl font-bold text-orange-900">
              {data.subscriptionStats.trialing}
            </p>
          </div>
        </div>
      </div>

      {/* Usage by Dimension */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Usage by Dimension
        </h3>
        <div className="space-y-3">
          {Object.entries(data.usageByDimension).map(
            ([dimension, quantity]) => (
              <div
                key={dimension}
                className="flex justify-between items-center"
              >
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {dimension.replace(/_/g, " ")}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {quantity.toLocaleString()}
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Usage by Organization */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Usage by Organization
        </h3>
        <div className="space-y-3">
          {Object.entries(data.usageByOrganization)
            .sort(([, a], [, b]) => b - a)
            .map(([orgName, quantity]) => (
              <div key={orgName} className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  {orgName}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {quantity.toLocaleString()}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Organizations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.organizations.map((org) => (
                <tr key={org.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {org.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        org.subscription_plan === "enterprise"
                          ? "bg-purple-100 text-purple-800"
                          : org.subscription_plan === "pro"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {org.subscription_plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        org.subscription_status === "active"
                          ? "bg-green-100 text-green-800"
                          : org.subscription_status === "trialing"
                          ? "bg-blue-100 text-blue-800"
                          : org.subscription_status === "past_due"
                          ? "bg-yellow-100 text-yellow-800"
                          : org.subscription_status === "canceled"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {org.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {org.seat_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(org.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Usage Records */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Usage Records
        </h3>
        <div className="space-y-3">
          {data.usageRecords.slice(0, 10).map((record) => {
            const org = data.organizations.find(
              (o) => o.id === record.organization_id
            );
            return (
              <div
                key={record.id}
                className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {org?.name || "Unknown Organization"}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    {record.dimension.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900">
                    {record.quantity.toLocaleString()}
                  </span>
                  <div className="text-xs text-gray-500">
                    {new Date(record.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
