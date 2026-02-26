import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "24h";

    const db = getDb();

    let dateFilter: string;
    switch (timeframe) {
      case "1w":
        dateFilter = "datetime('now', 'localtime', '-7 days')";
        break;
      case "1m":
        dateFilter = "datetime('now', 'localtime', '-1 month')";
        break;
      case "1y":
        dateFilter = "datetime('now', 'localtime', '-1 year')";
        break;
      case "24h":
      default:
        dateFilter = "datetime('now', 'localtime', '-1 day')";
        break;
    }

    // Get print statistics (excluding free accounts)
    const stats = db
      .prepare(
        `SELECT
          COUNT(*) as totalJobs,
          COALESCE(SUM(t.pages), 0) as totalPages,
          COALESCE(SUM(CASE WHEN t.type = 'print_sw' THEN t.pages ELSE 0 END), 0) as totalBwPages,
          COALESCE(SUM(CASE WHEN t.type = 'print_color' THEN t.pages ELSE 0 END), 0) as totalColorPages,
          COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END), 0) as totalRevenue
        FROM transactions t
        JOIN users u ON t.userId = u.userId
        WHERE t.type IN ('print_sw', 'print_color')
          AND t.timestamp >= ${dateFilter}
          AND u.is_free_account = 0
          AND t.status IN ('completed', 'pending')`
      )
      .get() as {
      totalJobs: number;
      totalPages: number;
      totalBwPages: number;
      totalColorPages: number;
      totalRevenue: number;
    };

    // Get deposit stats for the same timeframe
    const depositStats = db
      .prepare(
        `SELECT
          COUNT(*) as totalDeposits,
          COALESCE(SUM(amount), 0) as totalDepositAmount
        FROM transactions
        WHERE type = 'deposit'
          AND status = 'completed'
          AND timestamp >= ${dateFilter}`
      )
      .get() as { totalDeposits: number; totalDepositAmount: number };

    return NextResponse.json({
      ...stats,
      ...depositStats,
      timeframe,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
