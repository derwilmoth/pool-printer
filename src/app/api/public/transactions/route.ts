import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { normalizePublicUserId } from "@/lib/public-user";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = normalizePublicUserId(searchParams.get("userId"));

    if (!userId) {
      return NextResponse.json(
        {
          resolved: false,
          error: "userId is required",
          hint: "Provide userId as query parameter, for example: /api/public/transactions?userId=maxmustermann",
        },
        { status: 400 },
      );
    }
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const offset = (page - 1) * limit;

    const db = getDb();

    const countResult = db
      .prepare("SELECT COUNT(*) as total FROM transactions WHERE userId = ?")
      .get(userId) as { total: number };

    const transactions = db
      .prepare(
        `SELECT id, userId, amount, pages, type, status, paymentMethod, description, timestamp
         FROM transactions
         WHERE userId = ?
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
      )
      .all(userId, limit, offset);

    return NextResponse.json({
      resolved: true,
      userId,
      transactions,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch public transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch public transactions" },
      { status: 500 },
    );
  }
}
