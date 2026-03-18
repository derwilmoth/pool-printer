import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const state = searchParams.get("state") || "active";
    const accountState = state === "deletion_requested" ? "deletion_requested" : "active";
    const db = getDb();

    if (search) {
      const users = db
        .prepare(
          "SELECT userId, balance, is_free_account, account_state, deletion_requested_at, deletion_expires_at FROM users WHERE account_state = ? AND userId LIKE ? ORDER BY userId",
        )
        .all(accountState, `%${search}%`) as {
        userId: string;
        balance: number;
        is_free_account: number;
        account_state: string;
        deletion_requested_at: string | null;
        deletion_expires_at: string | null;
      }[];
      return NextResponse.json(users);
    }

    const users = db
      .prepare(
        "SELECT userId, balance, is_free_account, account_state, deletion_requested_at, deletion_expires_at FROM users WHERE account_state = ? ORDER BY userId",
      )
      .all(accountState) as {
      userId: string;
      balance: number;
      is_free_account: number;
      account_state: string;
      deletion_requested_at: string | null;
      deletion_expires_at: string | null;
    }[];

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = (body.userId as string)?.toLowerCase();
    const is_free_account = body.is_free_account;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    // Check if user already exists
    const existing = db
      .prepare("SELECT userId, account_state FROM users WHERE userId = ?")
      .get(userId) as { userId: string; account_state: string } | undefined;
    if (existing) {
      if (existing.account_state === "deletion_requested") {
        return NextResponse.json(
          { error: "User is pending deletion and can be restored" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    db.prepare(
      "INSERT INTO users (userId, balance, is_free_account, account_state, deletion_requested_at, deletion_expires_at, deletion_requested_by) VALUES (?, 0, ?, 'active', NULL, NULL, NULL)",
    ).run(
      userId,
      is_free_account ? 1 : 0,
    );

    return NextResponse.json({ userId, balance: 0, is_free_account: is_free_account ? 1 : 0 }, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId, is_free_account } = await request.json();
    const normalizedUserId = (userId as string)?.toLowerCase();

    if (!normalizedUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    const user = db
      .prepare("SELECT userId FROM users WHERE userId = ? AND account_state = 'active'")
      .get(normalizedUserId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    db.prepare("UPDATE users SET is_free_account = ? WHERE userId = ?").run(
      is_free_account ? 1 : 0,
      normalizedUserId,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();
    const normalizedUserId = (userId as string)?.toLowerCase();

    if (!normalizedUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    const user = db
      .prepare(
        "SELECT userId, account_state, deletion_expires_at FROM users WHERE userId = ?",
      )
      .get(normalizedUserId) as
      | {
          userId: string;
          account_state: string;
          deletion_expires_at: string | null;
        }
      | undefined;
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.account_state === "deletion_requested") {
      return NextResponse.json({
        success: true,
        alreadyRequested: true,
        deletion_expires_at: user.deletion_expires_at,
      });
    }

    db.prepare(
      `UPDATE users
       SET account_state = 'deletion_requested',
           deletion_requested_at = datetime('now', 'localtime'),
           deletion_expires_at = datetime('now', 'localtime', '+7 days'),
           deletion_requested_by = 'supervisor'
       WHERE userId = ?`,
    ).run(normalizedUserId);

    const updated = db
      .prepare("SELECT deletion_expires_at FROM users WHERE userId = ?")
      .get(normalizedUserId) as { deletion_expires_at: string | null };

    return NextResponse.json({ success: true, deletion_expires_at: updated.deletion_expires_at });
  } catch (error) {
    console.error("Failed to request user deletion:", error);
    return NextResponse.json({ error: "Failed to request user deletion" }, { status: 500 });
  }
}
