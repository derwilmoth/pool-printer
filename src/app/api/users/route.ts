import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const db = getDb();

    if (search) {
      const users = db
        .prepare("SELECT userId, balance, is_free_account FROM users WHERE userId LIKE ?")
        .all(`%${search}%`) as { userId: string; balance: number; is_free_account: number }[];
      return NextResponse.json(users);
    }

    const users = db
      .prepare("SELECT userId, balance, is_free_account FROM users ORDER BY userId")
      .all() as { userId: string; balance: number; is_free_account: number }[];

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId, is_free_account } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    // Check if user already exists
    const existing = db.prepare("SELECT userId FROM users WHERE userId = ?").get(userId);
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    db.prepare("INSERT INTO users (userId, balance, is_free_account) VALUES (?, 0, ?)").run(
      userId,
      is_free_account ? 1 : 0
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

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    const user = db.prepare("SELECT userId FROM users WHERE userId = ?").get(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    db.prepare("UPDATE users SET is_free_account = ? WHERE userId = ?").run(
      is_free_account ? 1 : 0,
      userId
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

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const db = getDb();

    const user = db.prepare("SELECT userId FROM users WHERE userId = ?").get(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const deleteUser = db.transaction(() => {
      db.prepare("DELETE FROM transactions WHERE userId = ?").run(userId);
      db.prepare("DELETE FROM users WHERE userId = ?").run(userId);
    });

    deleteUser();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
