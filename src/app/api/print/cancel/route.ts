import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { transactionId } = await request.json();

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    const db = getDb();

    const tx = db
      .prepare("SELECT id, userId, amount, status FROM transactions WHERE id = ?")
      .get(transactionId) as { id: number; userId: string; amount: number; status: string } | undefined;

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (tx.status !== "pending") {
      return NextResponse.json({ error: "Transaction is not pending" }, { status: 400 });
    }

    // Refund: restore balance and update status in a SQL Transaction
    const cancelTransaction = db.transaction(() => {
      db.prepare("UPDATE users SET balance = balance + ? WHERE userId = ?").run(tx.amount, tx.userId);
      db.prepare("UPDATE transactions SET status = 'refunded' WHERE id = ?").run(transactionId);
    });

    cancelTransaction();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel print:", error);
    return NextResponse.json({ error: "Failed to cancel print" }, { status: 500 });
  }
}
