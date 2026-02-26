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
      .prepare("SELECT id, status FROM transactions WHERE id = ?")
      .get(transactionId) as { id: number; status: string } | undefined;

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (tx.status !== "pending") {
      return NextResponse.json({ error: "Transaction is not pending" }, { status: 400 });
    }

    db.prepare("UPDATE transactions SET status = 'completed' WHERE id = ?").run(transactionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to confirm print:", error);
    return NextResponse.json({ error: "Failed to confirm print" }, { status: 500 });
  }
}
