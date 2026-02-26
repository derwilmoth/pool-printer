import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId, amount } = await request.json();

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid userId and positive amount (in cents) are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists, create if not
    let user = db.prepare("SELECT userId, balance FROM users WHERE userId = ?").get(userId) as
      | { userId: string; balance: number }
      | undefined;

    if (!user) {
      db.prepare("INSERT INTO users (userId, balance, is_free_account) VALUES (?, 0, 0)").run(userId);
      user = { userId, balance: 0 };
    }

    // SQL Transaction: update balance + insert transaction record
    const depositTransaction = db.transaction(() => {
      db.prepare("UPDATE users SET balance = balance + ? WHERE userId = ?").run(amount, userId);
      db.prepare(
        "INSERT INTO transactions (userId, amount, pages, type, status) VALUES (?, ?, 0, 'deposit', 'completed')"
      ).run(userId, amount);

      const updated = db
        .prepare("SELECT balance FROM users WHERE userId = ?")
        .get(userId) as { balance: number };

      return updated.balance;
    });

    const newBalance = depositTransaction();

    return NextResponse.json({ success: true, newBalance });
  } catch (error) {
    console.error("Failed to process deposit:", error);
    return NextResponse.json({ error: "Failed to process deposit" }, { status: 500 });
  }
}
