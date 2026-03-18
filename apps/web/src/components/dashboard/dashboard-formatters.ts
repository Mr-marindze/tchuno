import { Job, JobStatus } from "@/lib/jobs";

export type StatusTone = "loading" | "success" | "error";
export type StatusBadgeTone = "is-ok" | "is-muted" | "is-danger";

export function getStatusTone(message: string): StatusTone {
  const text = message.trim().toLowerCase();

  if (text.startsWith("a ")) {
    return "loading";
  }

  if (
    text.includes("erro") ||
    text.includes("falha") ||
    text.includes("invál") ||
    text.includes("inval")
  ) {
    return "error";
  }

  return "success";
}

export function formatCurrencyMzn(value: number | null): string {
  if (typeof value !== "number") {
    return "Sob cotação";
  }

  return new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRatingValue(rating: number | string): string {
  const parsed = typeof rating === "number" ? rating : Number(rating);
  if (Number.isNaN(parsed)) {
    return "0.0";
  }

  return parsed.toFixed(1);
}

export function formatStars(rating: number | string): string {
  const parsed = typeof rating === "number" ? rating : Number(rating);
  if (Number.isNaN(parsed)) {
    return "☆☆☆☆☆";
  }

  const rounded = Math.max(0, Math.min(5, Math.round(parsed)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatJobStatus(status: JobStatus): string {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^\w|\s\w)/g, (part) => part.toUpperCase());
}

export function getJobStatusBadgeTone(status: JobStatus): StatusBadgeTone {
  switch (status) {
    case "REQUESTED":
      return "is-muted";
    case "ACCEPTED":
    case "IN_PROGRESS":
    case "COMPLETED":
      return "is-ok";
    case "CANCELED":
      return "is-danger";
    default:
      return "is-muted";
  }
}

export function getRatingBadgeTone(rating: number | string): StatusBadgeTone {
  const parsed = typeof rating === "number" ? rating : Number(rating);
  if (Number.isNaN(parsed)) {
    return "is-muted";
  }

  if (parsed >= 4.5) {
    return "is-ok";
  }

  if (parsed >= 3) {
    return "is-muted";
  }

  return "is-danger";
}

export function formatPricingMode(value: Job["pricingMode"]): string {
  return value === "QUOTE_REQUEST" ? "Sob cotação" : "Preço fixo";
}

export function shortenId(value: string): string {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
