import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { resolveWindowsUser } from "@/lib/windows-user";

export async function GET(request: Request) {
  try {
    const resolved = resolveWindowsUser(request.headers);

    if (!resolved) {
      return NextResponse.json(
        {
          resolved: false,
          error: "Windows username could not be resolved",
          hint: "Provide one of the expected user headers via SSO proxy/IIS (for example: x-remote-user).",
        },
        { status: 400 },
      );
    }

    const userId = resolved.userId;

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
        source: resolved.source,
        exists: false,
        userId,
      });
    }

    return NextResponse.json({
      resolved: true,
      source: resolved.source,
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
