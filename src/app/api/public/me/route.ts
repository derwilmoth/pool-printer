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
          hint: "Provide userId as query parameter, for example: /api/public/me?userId=maxmustermann",
        },
        { status: 400 },
      );
    }

    const db = getDb();
    const user = db
      .prepare(
        "SELECT userId, balance, is_free_account, account_state, deletion_requested_at, deletion_expires_at FROM users WHERE userId = ?",
      )
      .get(userId) as
      | {
          userId: string;
          balance: number;
          is_free_account: number;
          account_state: string;
          deletion_requested_at: string | null;
          deletion_expires_at: string | null;
        }
      | undefined;

    if (!user) {
      return NextResponse.json({
        resolved: true,
        exists: false,
        userId,
      });
    }

    return NextResponse.json({
      resolved: true,
      exists: true,
      userId: user.userId,
      balance: user.balance,
      is_free_account: user.is_free_account,
      account_state: user.account_state,
      deletion_requested_at: user.deletion_requested_at,
      deletion_expires_at: user.deletion_expires_at,
    });
  } catch (error) {
    console.error("Failed to fetch public account summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch public account summary" },
      { status: 500 },
    );
  }
}
