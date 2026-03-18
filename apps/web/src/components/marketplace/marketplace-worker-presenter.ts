type WorkerCtaInput = {
  isOwnProfile?: boolean;
  isAvailable: boolean;
  hasHourlyRate: boolean;
};

export type WorkerCtaCopy = {
  primaryLabel: string;
  secondaryLabel: string;
};

type WorkerRelevanceInput = {
  isAvailable: boolean;
  ratingValue: number;
  ratingCount: number;
};

export type WorkerRelevance = {
  highlighted: boolean;
  label: string | null;
};

export function getWorkerCtaCopy(input: WorkerCtaInput): WorkerCtaCopy {
  if (input.isOwnProfile) {
    return {
      primaryLabel: "Gerir meu perfil",
      secondaryLabel: "Criar job de teste",
    };
  }

  if (!input.isAvailable) {
    return {
      primaryLabel: "Contactar para agenda",
      secondaryLabel: "Ver fluxo de contratação",
    };
  }

  if (!input.hasHourlyRate) {
    return {
      primaryLabel: "Pedir orçamento",
      secondaryLabel: "Ver fluxo de contratação",
    };
  }

  return {
    primaryLabel: "Pedir serviço",
    secondaryLabel: "Pedir orçamento",
  };
}

export function getWorkerRelevance(input: WorkerRelevanceInput): WorkerRelevance {
  if (!input.isAvailable) {
    return {
      highlighted: false,
      label: "Agenda ocupada",
    };
  }

  if (input.ratingValue >= 4.7 && input.ratingCount >= 8) {
    return {
      highlighted: true,
      label: "Top avaliado",
    };
  }

  if (input.ratingValue >= 4.3 && input.ratingCount >= 4) {
    return {
      highlighted: true,
      label: "Reputação forte",
    };
  }

  if (input.ratingCount >= 1) {
    return {
      highlighted: false,
      label: "Com histórico",
    };
  }

  return {
    highlighted: false,
    label: "Novo no marketplace",
  };
}
