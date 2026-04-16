import { verifyPublicLaunchToken } from "@/lib/public-launch";

export function normalizePublicUserId(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") return null;

  const trimmed = rawValue.trim().replace(/^"+|"+$/g, "");
  if (!trimmed) return null;

  const withoutDomainSlash = trimmed.includes("\\")
    ? trimmed.split("\\").pop() || ""
    : trimmed;

  const withoutDomainAt = withoutDomainSlash.includes("@")
    ? withoutDomainSlash.split("@")[0] || ""
    : withoutDomainSlash;

  const normalized = withoutDomainAt.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolvePublicUserIdFromRequest(request: Request): {
  userId: string | null;
  source: string | null;
  rawValue: string | null;
} {
  const url = new URL(request.url);
  const rawToken = url.searchParams.get("launchToken");
  if (!rawToken) {
    return {
      userId: null,
      source: null,
      rawValue: null,
    };
  }

  const tokenResult = verifyPublicLaunchToken(rawToken);
  if (!tokenResult.valid || !tokenResult.userId) {
    return {
      userId: null,
      source: null,
      rawValue: rawToken,
    };
  }

  const userId = normalizePublicUserId(tokenResult.userId);
  if (userId) {
    return { userId, source: "launchToken", rawValue: rawToken };
  }

  return {
    userId: null,
    source: null,
    rawValue: null,
  };
}
