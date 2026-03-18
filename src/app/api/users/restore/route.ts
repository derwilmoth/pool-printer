import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = (body.userId as string)?.toLowerCase();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    const user = db
      .prepare(
        "SELECT userId, account_state FROM users WHERE userId = ?",
      )
      .get(userId) as
      | {
          userId: string;
          account_state: string;
        }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.account_state !== "deletion_requested") {
      return NextResponse.json({ error: "User is not pending deletion" }, { status: 400 });
    }

    db.prepare(
      `UPDATE users
       SET account_state = 'active',
           deletion_requested_at = NULL,
           deletion_expires_at = NULL,
           deletion_requested_by = NULL
       WHERE userId = ?`,
    ).run(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to restore user:", error);
    return NextResponse.json({ error: "Failed to restore user" }, { status: 500 });
  }
}
