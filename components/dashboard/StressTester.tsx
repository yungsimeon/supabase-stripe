"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface StressTesterProps {
  organizationId: string;
}

export default function StressTester({ organizationId }: StressTesterProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
  });
  const supabase = createClient();

  const addResult = (message: string) => {
    setResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearResults = () => {
    setResults([]);
    setStats({
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
    });
  };

  const updateStats = (responseTime: number, success: boolean) => {
    setStats((prev) => {
      const newTotal = prev.totalRequests + 1;
      const newSuccessful = prev.successfulRequests + (success ? 1 : 0);
      const newFailed = prev.failedRequests + (success ? 0 : 1);
      const newAverage =
        (prev.averageResponseTime * prev.totalRequests + responseTime) /
        newTotal;
      const newMax = Math.max(prev.maxResponseTime, responseTime);
      const newMin = Math.min(prev.minResponseTime, responseTime);

      return {
        totalRequests: newTotal,
        successfulRequests: newSuccessful,
        failedRequests: newFailed,
        averageResponseTime: newAverage,
        maxResponseTime: newMax,
        minResponseTime: newMin === Infinity ? responseTime : newMin,
      };
    });
  };

  const runStressTest = async (
    testType: string,
    duration: number,
    concurrency: number
  ) => {
    setIsRunning(true);
    addResult(
      `Starting ${testType} stress test for ${duration}ms with ${concurrency} concurrent requests`
    );

    const startTime = Date.now();
    const endTime = startTime + duration;
    const promises: Promise<void>[] = [];

    const runTest = async () => {
      while (Date.now() < endTime && isRunning) {
        const testStart = Date.now();

        try {
          let result;
          switch (testType) {
            case "usage_records":
              result = await supabase.from("usage_records").insert({
                organization_id: organizationId,
                dimension: "stress_test",
                quantity: Math.floor(Math.random() * 100) + 1,
                timestamp: new Date().toISOString(),
              });
              break;
            case "organizations":
              result = await supabase
                .from("organizations")
                .select("*")
                .eq("id", organizationId);
              break;
            case "mixed":
              const operations = ["insert", "select", "update"];
              const operation =
                operations[Math.floor(Math.random() * operations.length)];

              switch (operation) {
                case "insert":
                  result = await supabase.from("usage_records").insert({
                    organization_id: organizationId,
                    dimension: "mixed_test",
                    quantity: Math.floor(Math.random() * 50) + 1,
                    timestamp: new Date().toISOString(),
                  });
                  break;
                case "select":
                  result = await supabase
                    .from("usage_records")
                    .select("*")
                    .eq("organization_id", organizationId)
                    .limit(10);
                  break;
                case "update":
                  result = await supabase
                    .from("organizations")
                    .update({ updated_at: new Date().toISOString() })
                    .eq("id", organizationId);
                  break;
              }
              break;
            default:
              result = await supabase
                .from("organizations")
                .select("*")
                .eq("id", organizationId);
          }

          const responseTime = Date.now() - testStart;
          updateStats(responseTime, !result?.error);

          if (result?.error) {
            addResult(
              `❌ Request failed: ${result.error.message} (${responseTime}ms)`
            );
          }
        } catch (err) {
          const responseTime = Date.now() - testStart;
          updateStats(responseTime, false);
          addResult(`❌ Request error: ${err} (${responseTime}ms)`);
        }

        // Small delay to prevent overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      }
    };

    // Start concurrent test runners
    for (let i = 0; i < concurrency; i++) {
      promises.push(runTest());
    }

    // Wait for all tests to complete
    await Promise.all(promises);

    const totalTime = Date.now() - startTime;
    addResult(`✅ Stress test completed in ${totalTime}ms`);
    addResult(
      `📊 Final stats: ${stats.successfulRequests}/${
        stats.totalRequests
      } successful, avg ${stats.averageResponseTime.toFixed(2)}ms response time`
    );

    setIsRunning(false);
  };

  const stopTest = () => {
    setIsRunning(false);
    addResult("🛑 Stress test stopped by user");
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Stress Tester</h3>
        <div className="flex space-x-2">
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700"
          >
            Clear Results
          </button>
          {isRunning && (
            <button
              onClick={stopTest}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
            >
              Stop Test
            </button>
          )}
        </div>
      </div>

      {/* Test Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Type
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            defaultValue="usage_records"
          >
            <option value="usage_records">Usage Records</option>
            <option value="organizations">Organizations</option>
            <option value="mixed">Mixed Operations</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Duration (seconds)
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            defaultValue="30"
          >
            <option value="10">10 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Concurrency
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            defaultValue="5"
          >
            <option value="1">1 request</option>
            <option value="5">5 requests</option>
            <option value="10">10 requests</option>
            <option value="25">25 requests</option>
            <option value="50">50 requests</option>
          </select>
        </div>
      </div>

      {/* Quick Test Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => runStressTest("usage_records", 10000, 5)}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          Quick Usage Test
        </button>
        <button
          onClick={() => runStressTest("organizations", 10000, 10)}
          disabled={isRunning}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
        >
          Quick Org Test
        </button>
        <button
          onClick={() => runStressTest("mixed", 30000, 15)}
          disabled={isRunning}
          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          Mixed Load Test
        </button>
        <button
          onClick={() => runStressTest("usage_records", 60000, 25)}
          disabled={isRunning}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Heavy Load Test
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800">Total Requests</h4>
          <p className="text-2xl font-bold text-blue-900">
            {stats.totalRequests}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-green-800">Successful</h4>
          <p className="text-2xl font-bold text-green-900">
            {stats.successfulRequests}
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-red-800">Failed</h4>
          <p className="text-2xl font-bold text-red-900">
            {stats.failedRequests}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-purple-800">Avg Response</h4>
          <p className="text-2xl font-bold text-purple-900">
            {stats.averageResponseTime.toFixed(0)}ms
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-orange-800">Max Response</h4>
          <p className="text-2xl font-bold text-orange-900">
            {stats.maxResponseTime}ms
          </p>
        </div>
      </div>

      {/* Results */}
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
