import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy") || "timestamp";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const db = getDb();
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (userId) {
      conditions.push("t.userId LIKE ?");
      params.push(`%${userId}%`);
    }

    if (type) {
      conditions.push("t.type = ?");
      params.push(type);
    }

    if (status) {
      conditions.push("t.status = ?");
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Validate sort column to prevent SQL injection
    const allowedSorts = ["timestamp", "userId", "amount", "type", "status", "pages"];
    const safeSort = allowedSorts.includes(sortBy) ? sortBy : "timestamp";
    const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

    // Get total count
    const countResult = db
      .prepare(`SELECT COUNT(*) as total FROM transactions t ${whereClause}`)
      .get(...params) as { total: number };

    // Get transactions
    const transactions = db
      .prepare(
        `SELECT t.id, t.userId, t.amount, t.pages, t.type, t.status, t.timestamp
         FROM transactions t
         ${whereClause}
         ORDER BY t.${safeSort} ${safeOrder}
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
