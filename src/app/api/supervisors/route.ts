import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import getDb from "@/lib/db";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  try {
    const db = getDb();
    const supervisors = db
      .prepare("SELECT id, username FROM supervisors")
      .all() as { id: number; username: string }[];

    return NextResponse.json(supervisors);
  } catch (error) {
    console.error("Failed to fetch supervisors:", error);
    return NextResponse.json({ error: "Failed to fetch supervisors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const db = getDb();

    // Check if username already exists
    const existing = db.prepare("SELECT id FROM supervisors WHERE username = ?").get(username);
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO supervisors (username, password_hash) VALUES (?, ?)")
      .run(username, hash);

    return NextResponse.json({ id: result.lastInsertRowid, username }, { status: 201 });
  } catch (error) {
    console.error("Failed to create supervisor:", error);
    return NextResponse.json({ error: "Failed to create supervisor" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Supervisor ID is required" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    // Get the supervisor to delete
    const supervisor = db
      .prepare("SELECT id, username FROM supervisors WHERE id = ?")
      .get(id) as { id: number; username: string } | undefined;

    if (!supervisor) {
      return NextResponse.json({ error: "Supervisor not found" }, { status: 404 });
    }

    // Prevent deleting yourself
    if (supervisor.username === session.user.name) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
    }

    db.prepare("DELETE FROM supervisors WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete supervisor:", error);
    return NextResponse.json({ error: "Failed to delete supervisor" }, { status: 500 });
  }
}
