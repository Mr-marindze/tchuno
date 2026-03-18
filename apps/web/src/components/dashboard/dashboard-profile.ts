import { WorkerProfile } from "@/lib/worker-profile";

export type LocationParts = {
  city: string;
  neighborhood: string;
};

export type ProfileReputation = {
  label: string;
  tone: "is-ok" | "is-muted" | "is-danger";
};

export type ProfileCompleteness = {
  score: number;
  total: number;
  percent: number;
  missing: string[];
  location: LocationParts;
};

export function parseLocationParts(value: string | null): LocationParts {
  if (!value || value.trim().length === 0) {
    return {
      city: "Não indicado",
      neighborhood: "Não indicado",
    };
  }

  const parts = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parts.length === 0) {
    return {
      city: "Não indicado",
      neighborhood: "Não indicado",
    };
  }

  if (parts.length === 1) {
    return {
      city: parts[0],
      neighborhood: "Não indicado",
    };
  }

  return {
    city: parts[0],
    neighborhood: parts.slice(1).join(", "),
  };
}

export function getProfileReputation(
  ratingValue: number | string,
  ratingCount: number,
): ProfileReputation {
  const avg =
    typeof ratingValue === "number" ? ratingValue : Number(ratingValue);

  if (ratingCount >= 10 && avg >= 4.6) {
    return { label: "Top reputação", tone: "is-ok" };
  }

  if (ratingCount >= 5 && avg >= 4) {
    return { label: "Reputação confiável", tone: "is-ok" };
  }

  if (ratingCount >= 3 && avg < 3.5) {
    return { label: "Reputação em revisão", tone: "is-danger" };
  }

  if (ratingCount > 0) {
    return { label: "Reputação inicial", tone: "is-muted" };
  }

  return { label: "Sem histórico", tone: "is-muted" };
}

export function getProfileCompleteness(profile: WorkerProfile): ProfileCompleteness {
  const location = parseLocationParts(profile.location);
  const checks = [
    {
      ok: (profile.bio ?? "").trim().length >= 40,
      label: "Bio curta (mín. 40 caracteres)",
    },
    {
      ok:
        profile.location !== null &&
        profile.location.trim().length > 0 &&
        location.neighborhood !== "Não indicado",
      label: "Localização incompleta (usa Cidade, Bairro)",
    },
    {
      ok: typeof profile.hourlyRate === "number" && profile.hourlyRate > 0,
      label: "Tarifa por hora não definida",
    },
    {
      ok: profile.experienceYears > 0,
      label: "Experiência não definida",
    },
    {
      ok: profile.categories.length > 0,
      label: "Sem categorias associadas",
    },
    {
      ok: profile.isAvailable,
      label: "Perfil está indisponível",
    },
  ];

  const score = checks.filter((item) => item.ok).length;
  const total = checks.length;
  const missing = checks.filter((item) => !item.ok).map((item) => item.label);

  return {
    score,
    total,
    percent: Math.round((score / total) * 100),
    missing,
    location,
  };
}
