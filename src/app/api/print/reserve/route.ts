import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = (body.userId as string)?.toLowerCase();
    const pages = body.pages;
    const printerType = body.printerType;
    const jobKey = typeof body.jobKey === "string" ? body.jobKey.trim() : "";

    if (!userId || !pages || !printerType || !jobKey) {
      return NextResponse.json(
        { error: "userId, pages, printerType, and jobKey are required" },
        { status: 400 }
      );
    }

    if (!["bw", "color"].includes(printerType)) {
      return NextResponse.json(
        { error: "printerType must be 'bw' or 'color'" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists
    const user = db
      .prepare(
        "SELECT userId, balance, is_free_account FROM users WHERE userId = ? AND account_state = 'active'",
      )
      .get(userId) as { userId: string; balance: number; is_free_account: number } | undefined;

    if (!user) {
      return NextResponse.json({
        allowed: false,
        reason: "User not found or account inactive",
        balance: 0,
        required: 0,
      });
    }

    // Free account: allow without logging or deducting
    if (user.is_free_account) {
      return NextResponse.json({ allowed: true, isFree: true });
    }

    // Get price from settings
    const priceKey = printerType === "bw" ? "price_bw" : "price_color";
    const priceSetting = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(priceKey) as { value: string } | undefined;

    const pricePerPage = priceSetting ? parseInt(priceSetting.value, 10) : (printerType === "bw" ? 5 : 20);
    const totalCost = pricePerPage * pages;
    const type = printerType === "bw" ? "print_bw" : "print_color";
    const reservationMarker = `print_job:${jobKey}`;

    // Check balance
    if (user.balance < totalCost) {
      return NextResponse.json({
        allowed: false,
        reason: "Insufficient balance",
        balance: user.balance,
        required: totalCost,
      });
    }

    // Deduct/create atomically and deduplicate by unique spooler job key marker
    const reserveTransaction = db.transaction(() => {
      const existing = db
        .prepare(
          "SELECT id FROM transactions WHERE description = ? AND status = 'pending' LIMIT 1",
        )
        .get(reservationMarker) as { id: number } | undefined;

      if (existing) {
        return { transactionId: existing.id, deduplicated: true };
      }

      db.prepare("UPDATE users SET balance = balance - ? WHERE userId = ?").run(totalCost, userId);

      const result = db
        .prepare(
          "INSERT INTO transactions (userId, amount, pages, type, description, status) VALUES (?, ?, ?, ?, ?, 'pending')",
        )
        .run(userId, totalCost, pages, type, reservationMarker);

      return { transactionId: Number(result.lastInsertRowid), deduplicated: false };
    });

    const reservation = reserveTransaction();

    return NextResponse.json({
      allowed: true,
      isFree: false,
      transactionId: reservation.transactionId,
      deduplicated: reservation.deduplicated,
    });
  } catch (error) {
    console.error("Failed to reserve print:", error);
    return NextResponse.json({ error: "Failed to reserve print" }, { status: 500 });
  }
}
