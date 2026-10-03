export const COMMISSION_TIME_ZONE = "America/Santiago";

export function formatCommissionDate(value: Date | null): string {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: COMMISSION_TIME_ZONE,
  }).format(value);
}
