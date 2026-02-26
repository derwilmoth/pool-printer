import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { userId, pages, printerType } = await request.json();

    if (!userId || !pages || !printerType) {
      return NextResponse.json(
        { error: "userId, pages, and printerType are required" },
        { status: 400 }
      );
    }

    if (!["sw", "color"].includes(printerType)) {
      return NextResponse.json(
        { error: "printerType must be 'sw' or 'color'" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if user exists
    const user = db
      .prepare("SELECT userId, balance, is_free_account FROM users WHERE userId = ?")
      .get(userId) as { userId: string; balance: number; is_free_account: number } | undefined;

    if (!user) {
      return NextResponse.json({ allowed: false, reason: "User not found" });
    }

    // Free account: allow without logging or deducting
    if (user.is_free_account) {
      return NextResponse.json({ allowed: true, isFree: true });
    }

    // Get price from settings
    const priceKey = printerType === "sw" ? "price_sw" : "price_color";
    const priceSetting = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get(priceKey) as { value: string } | undefined;

    const pricePerPage = priceSetting ? parseInt(priceSetting.value, 10) : (printerType === "sw" ? 5 : 20);
    const totalCost = pricePerPage * pages;

    // Check balance
    if (user.balance < totalCost) {
      return NextResponse.json({
        allowed: false,
        reason: "Insufficient balance",
        balance: user.balance,
        required: totalCost,
      });
    }

    // Deduct balance and create pending transaction in a SQL Transaction
    const reserveTransaction = db.transaction(() => {
      db.prepare("UPDATE users SET balance = balance - ? WHERE userId = ?").run(totalCost, userId);

      const type = printerType === "sw" ? "print_sw" : "print_color";
      const result = db
        .prepare(
          "INSERT INTO transactions (userId, amount, pages, type, status) VALUES (?, ?, ?, ?, 'pending')"
        )
        .run(userId, totalCost, pages, type);

      return result.lastInsertRowid;
    });

    const transactionId = reserveTransaction();

    return NextResponse.json({
      allowed: true,
      isFree: false,
      transactionId: Number(transactionId),
    });
  } catch (error) {
    console.error("Failed to reserve print:", error);
    return NextResponse.json({ error: "Failed to reserve print" }, { status: 500 });
  }
}
