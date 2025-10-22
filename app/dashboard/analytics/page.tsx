"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AnalyticsDashboard from "@/components/dashboard/AnalyticsDashboard";
import UsageTracker from "@/components/dashboard/UsageTracker";
import BillingInsights from "@/components/dashboard/BillingInsights";
import EdgeCaseTester from "@/components/dashboard/EdgeCaseTester";
import StressTester from "@/components/dashboard/StressTester";

export default function AnalyticsPage() {
  const [currentOrg, setCurrentOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchCurrentOrg = async () => {
      try {
        setLoading(true);

        // Get current user
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (!user) {
          setError("No user found");
          return;
        }

        // Get user's organization
        const { data: member, error: memberError } = await supabase
          .from("organization_members")
          .select(
            `
            organization_id,
            organizations (
              id,
              name,
              slug,
              subscription_status,
              subscription_plan,
              seat_count
            )
          `
          )
          .eq("user_id", user.id)
          .single();

        if (memberError) throw memberError;

        setCurrentOrg(member.organizations);
      } catch (err) {
        console.error("Error fetching organization:", err);
        setError("Failed to load organization data");
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentOrg();
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

  if (!currentOrg) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <p className="text-yellow-800">
          No organization found. Please join an organization first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Analytics & Testing Dashboard
        </h1>
        <p className="text-gray-600">
          Comprehensive analytics, usage tracking, billing insights, and edge
          case testing for {currentOrg.name}
        </p>
      </div>

      {/* Analytics Dashboard */}
      <AnalyticsDashboard />

      {/* Usage Tracker */}
      <UsageTracker
        organizationId={currentOrg.id}
        dimension="api_calls"
        onUsageRecorded={(quantity) => {
          console.log(`Recorded ${quantity} API calls`);
        }}
      />

      {/* Billing Insights */}
      <BillingInsights organizationId={currentOrg.id} />

      {/* Edge Case Tester */}
      <EdgeCaseTester organizationId={currentOrg.id} />

      {/* Stress Tester */}
      <StressTester organizationId={currentOrg.id} />

      {/* Additional Usage Trackers for Different Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UsageTracker organizationId={currentOrg.id} dimension="storage_gb" />
        <UsageTracker organizationId={currentOrg.id} dimension="bandwidth_gb" />
      </div>
    </div>
  );
}
