import { createServiceClient } from "@/lib/supabase/server";

export class UsageTracker {
  private organizationId: string;
  private supabase: any;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServiceClient();
    }
    return this.supabase;
  }

  /**
   * Track usage for a specific dimension
   * This method is idempotent and safe for batch operations
   */
  async trackUsage(
    dimension: string,
    quantity: number,
    timestamp?: Date,
    idempotencyKey?: string
  ) {
    const supabase = await this.getSupabase();
    const usageTimestamp = timestamp || new Date();

    // Check if we already have a record for this idempotency key
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("usage_records")
        .select("id")
        .eq("organization_id", this.organizationId)
        .eq("dimension", dimension)
        .eq("stripe_usage_record_id", idempotencyKey)
        .single();

      if (existing) {
        return { id: existing.id, alreadyRecorded: true };
      }
    }

    // Create usage record
    const { data, error } = await supabase
      .from("usage_records")
      .insert({
        organization_id: this.organizationId,
        dimension,
        quantity,
        timestamp: usageTimestamp.toISOString(),
        stripe_usage_record_id: idempotencyKey,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to track usage: ${error.message}`);
    }

    return { id: data.id, alreadyRecorded: false };
  }

  /**
   * Get usage summary for a time period
   */
  async getUsageSummary(dimension: string, startDate: Date, endDate: Date) {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("usage_records")
      .select("quantity, timestamp")
      .eq("organization_id", this.organizationId)
      .eq("dimension", dimension)
      .gte("timestamp", startDate.toISOString())
      .lte("timestamp", endDate.toISOString())
      .order("timestamp", { ascending: true });

    if (error) {
      throw new Error(`Failed to get usage summary: ${error.message}`);
    }

    const totalUsage = data.reduce(
      (sum: number, record: any) => sum + record.quantity,
      0
    );
    const recordCount = data.length;

    return {
      totalUsage,
      recordCount,
      records: data,
      period: {
        start: startDate,
        end: endDate,
      },
    };
  }

  /**
   * Get current month usage
   */
  async getCurrentMonthUsage(dimension: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.getUsageSummary(dimension, startOfMonth, endOfMonth);
  }

  /**
   * Batch track multiple usage records
   */
  async batchTrackUsage(
    records: Array<{
      dimension: string;
      quantity: number;
      timestamp?: Date;
      idempotencyKey?: string;
    }>
  ) {
    const supabase = await this.getSupabase();

    const usageRecords = records.map((record) => ({
      organization_id: this.organizationId,
      dimension: record.dimension,
      quantity: record.quantity,
      timestamp: (record.timestamp || new Date()).toISOString(),
      stripe_usage_record_id: record.idempotencyKey,
    }));

    const { data, error } = await supabase
      .from("usage_records")
      .insert(usageRecords)
      .select();

    if (error) {
      throw new Error(`Failed to batch track usage: ${error.message}`);
    }

    return data;
  }
}

/**
 * Convenience function to create a usage tracker for an organization
 */
export function createUsageTracker(organizationId: string) {
  return new UsageTracker(organizationId);
}

/**
 * Example usage tracking functions for common scenarios
 */
export const UsageDimensions = {
  API_CALLS: "api_calls",
  STORAGE_GB: "storage_gb",
  EMAILS_SENT: "emails_sent",
  USERS_CREATED: "users_created",
} as const;

export type UsageDimension =
  (typeof UsageDimensions)[keyof typeof UsageDimensions];
