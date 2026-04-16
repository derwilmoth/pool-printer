import { NextResponse } from "next/server";
import { createPublicLaunchToken } from "@/lib/public-launch";
import { normalizePublicUserId } from "@/lib/public-user";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const providedKey = typeof body?.key === "string" ? body.key.trim() : "";
    const rawUsername = typeof body?.username === "string" ? body.username : "";
    const normalizedUser = normalizePublicUserId(rawUsername);

    const expectedKey = process.env.PUBLIC_LAUNCH_SECRET?.trim();
    if (!expectedKey) {
      return NextResponse.json(
        { error: "PUBLIC_LAUNCH_SECRET is not configured" },
        { status: 500 },
      );
    }

    if (!providedKey || providedKey !== expectedKey) {
      return NextResponse.json({ error: "Invalid launcher key" }, { status: 403 });
    }

    if (!normalizedUser) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    const launchToken = createPublicLaunchToken(normalizedUser);

    return NextResponse.json({
      ok: true,
      launchToken,
      user: normalizedUser,
    });
  } catch (error) {
    console.error("Failed to create public launch token:", error);
    return NextResponse.json({ error: "Failed to create launch token" }, { status: 500 });
  }
}
