"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UsageTrackerProps {
  organizationId: string;
  dimension: string;
  onUsageRecorded?: (quantity: number) => void;
}

export default function UsageTracker({
  organizationId,
  dimension,
  onUsageRecorded,
}: UsageTrackerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [totalUsage, setTotalUsage] = useState(0);
  const [sessionUsage, setSessionUsage] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const fetchCurrentUsage = async () => {
      const { data, error } = await supabase
        .from("usage_records")
        .select("quantity")
        .eq("organization_id", organizationId)
        .eq("dimension", dimension)
        .order("timestamp", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setTotalUsage(data[0].quantity);
      }
    };

    fetchCurrentUsage();
  }, [organizationId, dimension, supabase]);

  const startTracking = () => {
    setIsTracking(true);
    setSessionUsage(0);
  };

  const stopTracking = () => {
    setIsTracking(false);
  };

  const recordUsage = async (quantity: number) => {
    try {
      const { error } = await supabase.from("usage_records").insert({
        organization_id: organizationId,
        dimension,
        quantity,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        console.error("Error recording usage:", error);
        return;
      }

      setTotalUsage((prev) => prev + quantity);
      setSessionUsage((prev) => prev + quantity);
      onUsageRecorded?.(quantity);
    } catch (err) {
      console.error("Error recording usage:", err);
    }
  };

  const simulateUsage = () => {
    if (!isTracking) return;

    const randomQuantity = Math.floor(Math.random() * 10) + 1;
    recordUsage(randomQuantity);

    // Schedule next usage event
    setTimeout(simulateUsage, Math.random() * 5000 + 1000);
  };

  useEffect(() => {
    if (isTracking) {
      simulateUsage();
    }
  }, [isTracking]);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Usage Tracker - {dimension.replace(/_/g, " ")}
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={startTracking}
            disabled={isTracking}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              isTracking
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            Start Tracking
          </button>
          <button
            onClick={stopTracking}
            disabled={!isTracking}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              !isTracking
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
          >
            Stop Tracking
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800">Total Usage</h4>
          <p className="text-2xl font-bold text-blue-900">
            {totalUsage.toLocaleString()}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-green-800">Session Usage</h4>
          <p className="text-2xl font-bold text-green-900">
            {sessionUsage.toLocaleString()}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-purple-800">Status</h4>
          <p className="text-lg font-bold text-purple-900">
            {isTracking ? "🟢 Tracking" : "🔴 Stopped"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => recordUsage(1)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          Record +1 Usage
        </button>
        <button
          onClick={() => recordUsage(10)}
          className="ml-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          Record +10 Usage
        </button>
      </div>
    </div>
  );
}
