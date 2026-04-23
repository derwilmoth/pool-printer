import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { transactionId, action } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    const requestedAction =
      action === "mark_completed" || action === "mark_refunded"
        ? action
        : "mark_refunded";

    const db = getDb();

    const tx = db
      .prepare("SELECT id, userId, amount, status, type FROM transactions WHERE id = ?")
      .get(transactionId) as
      | { id: number; userId: string; amount: number; status: string; type: string }
      | undefined;

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (tx.type === "deposit") {
      return NextResponse.json({ error: "Deposits cannot be changed here" }, { status: 400 });
    }

    if (requestedAction === "mark_refunded") {
      if (tx.status !== "pending" && tx.status !== "completed") {
        return NextResponse.json(
          { error: "Only pending or completed transactions can be refunded" },
          { status: 400 }
        );
      }

      const refundTransaction = db.transaction(() => {
        db.prepare("UPDATE users SET balance = balance + ? WHERE userId = ?").run(tx.amount, tx.userId);
        db.prepare("UPDATE transactions SET status = 'refunded' WHERE id = ?").run(transactionId);
      });

      refundTransaction();
      return NextResponse.json({ success: true, status: "refunded" });
    }

    if (tx.status !== "refunded") {
      return NextResponse.json(
        { error: "Only refunded transactions can be marked completed" },
        { status: 400 }
      );
    }

    const user = db
      .prepare("SELECT balance FROM users WHERE userId = ?")
      .get(tx.userId) as { balance: number } | undefined;

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.balance < tx.amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const markCompletedTransaction = db.transaction(() => {
      db.prepare("UPDATE users SET balance = balance - ? WHERE userId = ?").run(tx.amount, tx.userId);
      db.prepare("UPDATE transactions SET status = 'completed' WHERE id = ?").run(transactionId);
    });

    markCompletedTransaction();

    return NextResponse.json({ success: true, status: "completed" });
  } catch (error) {
    console.error("Failed to cancel transaction:", error);
    return NextResponse.json({ error: "Failed to cancel transaction" }, { status: 500 });
  }
}
