export function normalizePublicUserId(rawValue: unknown): string | null {
  if (typeof rawValue !== "string") return null;

  const normalized = rawValue.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
