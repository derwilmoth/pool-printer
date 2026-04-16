import crypto from "crypto";

type LaunchPayload = {
  u: string;
  exp: number;
};

function getLaunchSecret(): string {
  const secret = process.env.PUBLIC_LAUNCH_SECRET?.trim();
  if (!secret) {
    throw new Error("PUBLIC_LAUNCH_SECRET is not configured");
  }
  return secret;
}

function getLaunchTtlSeconds(): number {
  const raw = process.env.PUBLIC_LAUNCH_TTL_SECONDS;
  const parsed = raw ? Number.parseInt(raw, 10) : 120;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 120;
  }
  return parsed;
}

function signPayload(encodedPayload: string): string {
  const secret = getLaunchSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

export function createPublicLaunchToken(userId: string): string {
  const payload: LaunchPayload = {
    u: userId,
    exp: Math.floor(Date.now() / 1000) + getLaunchTtlSeconds(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyPublicLaunchToken(token: string): {
  valid: boolean;
  userId: string | null;
  reason?: string;
} {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, userId: null, reason: "invalid_format" };
  }

  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return { valid: false, userId: null, reason: "invalid_format" };
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, userId: null, reason: "bad_signature" };
  }

  let payload: LaunchPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as LaunchPayload;
  } catch {
    return { valid: false, userId: null, reason: "bad_payload" };
  }

  if (!payload?.u || typeof payload.u !== "string") {
    return { valid: false, userId: null, reason: "missing_user" };
  }

  if (!payload?.exp || typeof payload.exp !== "number") {
    return { valid: false, userId: null, reason: "missing_exp" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { valid: false, userId: null, reason: "expired" };
  }

  return { valid: true, userId: payload.u };
}
