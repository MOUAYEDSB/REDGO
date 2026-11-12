export function formatMillimes(value: number) {
  return `${(value / 1000).toFixed(3).replace(".", ",")} DT`;
}

export function millimesToInput(value: number) {
  return (value / 1000).toFixed(3);
}

export function parseMillimes(value: string, allowZero: boolean): number | null {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (!Number.isSafeInteger(amount) || (!allowZero && amount === 0)) return null;
  return amount;
}

export function slugify(value: string, maxLength = 96) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, maxLength);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-TN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatDay(value: string) {
  return new Date(value).toLocaleDateString("fr-TN", { day: "2-digit", month: "short" });
}

export function errorMessage(error: unknown, fallback = "Impossible de communiquer avec Supabase.") {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "AD";
}
