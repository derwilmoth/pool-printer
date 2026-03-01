import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = (body.userId as string)?.toLowerCase();
    const amount = body.amount;
    const description = body.description;

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid userId and positive amount (in cents) are required" },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists
    const user = db.prepare("SELECT userId, balance FROM users WHERE userId = ?").get(userId) as
      | { userId: string; balance: number }
      | undefined;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.balance < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // SQL Transaction: deduct balance + insert transaction record
    const chargeTransaction = db.transaction(() => {
      db.prepare("UPDATE users SET balance = balance - ? WHERE userId = ?").run(amount, userId);
      db.prepare(
        "INSERT INTO transactions (userId, amount, pages, type, status, description) VALUES (?, ?, 0, 'manual', 'completed', ?)"
      ).run(userId, amount, description.trim());

      const updated = db
        .prepare("SELECT balance FROM users WHERE userId = ?")
        .get(userId) as { balance: number };

      return updated.balance;
    });

    const newBalance = chargeTransaction();

    return NextResponse.json({ success: true, newBalance });
  } catch (error) {
    console.error("Failed to process charge:", error);
    return NextResponse.json({ error: "Failed to process charge" }, { status: 500 });
  }
}
