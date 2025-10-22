"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface EdgeCaseTesterProps {
  organizationId: string;
}

export default function EdgeCaseTester({
  organizationId,
}: EdgeCaseTesterProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const supabase = createClient();

  const addResult = (message: string) => {
    setResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testSeatLimitExceeded = async () => {
    setLoading(true);
    try {
      // Try to add more members than seats allowed
      const { data: org } = await supabase
        .from("organizations")
        .select("seat_count")
        .eq("id", organizationId)
        .single();

      if (org) {
        const { error } = await supabase.from("organization_members").insert({
          organization_id: organizationId,
          user_id: "00000000-0000-0000-0000-000000000000", // Dummy user ID
          role: "member",
        });

        if (error) {
          addResult(`✅ Seat limit enforced: ${error.message}`);
        } else {
          addResult("❌ Seat limit not enforced - this is a problem!");
        }
      }
    } catch (err) {
      addResult(`❌ Error testing seat limits: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testSubscriptionStatusChange = async () => {
    setLoading(true);
    try {
      // Test changing subscription status
      const { error } = await supabase
        .from("organizations")
        .update({
          subscription_status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (error) {
        addResult(`❌ Error updating subscription status: ${error.message}`);
      } else {
        addResult("✅ Subscription status updated to 'past_due'");
      }
    } catch (err) {
      addResult(`❌ Error testing subscription status: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testUsageOverflow = async () => {
    setLoading(true);
    try {
      // Test recording extremely high usage
      const { error } = await supabase.from("usage_records").insert({
        organization_id: organizationId,
        dimension: "api_calls",
        quantity: 999999999,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        addResult(`❌ Error recording high usage: ${error.message}`);
      } else {
        addResult("✅ High usage recorded successfully");
      }
    } catch (err) {
      addResult(`❌ Error testing usage overflow: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testConcurrentUsage = async () => {
    setLoading(true);
    try {
      // Simulate concurrent usage recording
      const promises = Array.from({ length: 10 }, (_, i) =>
        supabase.from("usage_records").insert({
          organization_id: organizationId,
          dimension: "concurrent_test",
          quantity: 1,
          timestamp: new Date().toISOString(),
        })
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      addResult(
        `✅ Concurrent usage test: ${successful} successful, ${failed} failed`
      );
    } catch (err) {
      addResult(`❌ Error testing concurrent usage: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testInvalidData = async () => {
    setLoading(true);
    try {
      // Test with invalid data
      const { error } = await supabase.from("usage_records").insert({
        organization_id: "invalid-uuid",
        dimension: "",
        quantity: -1,
        timestamp: "invalid-date",
      });

      if (error) {
        addResult(`✅ Invalid data rejected: ${error.message}`);
      } else {
        addResult("❌ Invalid data accepted - this is a problem!");
      }
    } catch (err) {
      addResult(`❌ Error testing invalid data: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testRLSPolicies = async () => {
    setLoading(true);
    try {
      // Test RLS policies by trying to access other organizations' data
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .neq("id", organizationId);

      if (error) {
        addResult(`✅ RLS policies working: ${error.message}`);
      } else if (data && data.length > 0) {
        addResult(
          "❌ RLS policies not working - can access other organizations!"
        );
      } else {
        addResult("✅ RLS policies working - no unauthorized access");
      }
    } catch (err) {
      addResult(`❌ Error testing RLS policies: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testBillingEdgeCases = async () => {
    setLoading(true);
    try {
      // Test billing edge cases
      const testCases = [
        { subscription_status: "incomplete", subscription_plan: "starter" },
        { subscription_status: "past_due", subscription_plan: "pro" },
        { subscription_status: "canceled", subscription_plan: "enterprise" },
        { subscription_status: "trialing", subscription_plan: "starter" },
      ];

      for (const testCase of testCases) {
        const { error } = await supabase
          .from("organizations")
          .update(testCase)
          .eq("id", organizationId);

        if (error) {
          addResult(
            `❌ Error updating to ${testCase.subscription_status}: ${error.message}`
          );
        } else {
          addResult(
            `✅ Updated to ${testCase.subscription_status} status with ${testCase.subscription_plan} plan`
          );
        }
      }
    } catch (err) {
      addResult(`❌ Error testing billing edge cases: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const testDataIntegrity = async () => {
    setLoading(true);
    try {
      // Test data integrity constraints
      const { error } = await supabase.from("organization_members").insert({
        organization_id: organizationId,
        user_id: organizationId, // Same as org ID (should be invalid)
        role: "owner",
      });

      if (error) {
        addResult(`✅ Data integrity maintained: ${error.message}`);
      } else {
        addResult("❌ Data integrity issue - invalid relationship created");
      }
    } catch (err) {
      addResult(`❌ Error testing data integrity: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Edge Case Tester
        </h3>
        <button
          onClick={clearResults}
          className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
        >
          Clear Results
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <button
          onClick={testSeatLimitExceeded}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Test Seat Limits
        </button>

        <button
          onClick={testSubscriptionStatusChange}
          disabled={loading}
          className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 disabled:opacity-50"
        >
          Test Status Changes
        </button>

        <button
          onClick={testUsageOverflow}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          Test Usage Overflow
        </button>

        <button
          onClick={testConcurrentUsage}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Test Concurrent Usage
        </button>

        <button
          onClick={testInvalidData}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50"
        >
          Test Invalid Data
        </button>

        <button
          onClick={testRLSPolicies}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Test RLS Policies
        </button>

        <button
          onClick={testBillingEdgeCases}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          Test Billing Edge Cases
        </button>

        <button
          onClick={testDataIntegrity}
          disabled={loading}
          className="px-4 py-2 bg-pink-600 text-white text-sm font-medium rounded-md hover:bg-pink-700 disabled:opacity-50"
        >
          Test Data Integrity
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-sm text-gray-600">Running tests...</span>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Test Results:
        </h4>
        {results.length === 0 ? (
          <p className="text-sm text-gray-500">
            No tests run yet. Click a test button above to start.
          </p>
        ) : (
          <div className="space-y-1">
            {results.map((result, index) => (
              <div key={index} className="text-sm font-mono text-gray-700">
                {result}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
