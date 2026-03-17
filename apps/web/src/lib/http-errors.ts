type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

const humanMessages: Record<string, string> = {
  "Invalid credentials": "Email ou password inválidos.",
  "Refresh token is required": "Sessão expirada. Faz login novamente.",
  "Invalid refresh token": "Sessão inválida. Faz login novamente.",
  "Email is already in use": "Já existe uma conta com este email.",
  "Only completed jobs can be reviewed":
    "Só podes avaliar jobs que estejam concluídos.",
  "This job already has a review": "Este job já foi avaliado.",
  "Worker profile not found": "Perfil profissional não encontrado.",
  "Job not found": "Job não encontrado.",
  "Category not found": "Categoria não encontrada.",
  "Worker is not currently available":
    "Este profissional está indisponível neste momento.",
  "Worker profile is not linked to this category":
    "Este profissional não trabalha nesta categoria.",
  "Category name or slug already exists":
    "Já existe uma categoria com este nome ou slug.",
  "One or more categories are invalid or inactive":
    "Uma ou mais categorias são inválidas ou estão inativas.",
  "Only the job client can review this job":
    "Só o cliente do job pode criar review.",
  "You are not allowed to update this job":
    "Não tens permissão para atualizar este job.",
  "You are not allowed to access this job":
    "Não tens permissão para aceder a este job.",
  "Unable to generate a valid slug":
    "Não foi possível gerar um slug válido para a categoria.",
  "scheduledFor must be in the future": "A data agendada deve ser futura.",
  "name contains invalid characters":
    "Nome contém caracteres inválidos. Usa apenas letras, números, espaço, _ ou -.",
  "password must contain at least one letter and one number":
    "Password deve conter pelo menos 1 letra e 1 número.",
};

const fieldLabels: Record<string, string> = {
  email: "Email",
  password: "Password",
  name: "Nome",
  includeInactive: "Incluir inativas",
  categorySlug: "Slug da categoria",
  isAvailable: "Disponibilidade",
  limit: "Limite",
  offset: "Offset",
  status: "Estado",
  sort: "Ordenação",
  workerProfileId: "Profissional",
  categoryId: "Categoria",
  title: "Título",
  description: "Descrição",
  budget: "Orçamento",
  scheduledFor: "Data agendada",
  jobId: "Job",
  rating: "Rating",
  comment: "Comentário",
  bio: "Bio",
  location: "Localização",
  hourlyRate: "Tarifa por hora",
  experienceYears: "Anos de experiência",
  categoryIds: "Categorias",
  refreshToken: "Refresh token",
  "x-device-id": "Dispositivo",
};

function humanizeField(field: string): string {
  const normalized = field.trim().replace(/^property\s+/i, "");
  return fieldLabels[normalized] ?? normalized;
}

function splitMessageParts(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function humanizeValidationMessage(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let match = trimmed.match(/^property (.+) should not exist$/i);
  if (match) {
    return `Campo "${humanizeField(match[1])}" não é permitido.`;
  }

  match = trimmed.match(/^(.+) should not be empty$/i);
  if (match) {
    return `${humanizeField(match[1])} é obrigatório.`;
  }

  match = trimmed.match(/^(.+) must be a string$/i);
  if (match) {
    return `${humanizeField(match[1])} deve ser texto.`;
  }

  match = trimmed.match(/^(.+) must be an integer number$/i);
  if (match) {
    return `${humanizeField(match[1])} deve ser um número inteiro.`;
  }

  match = trimmed.match(/^(.+) must be a boolean value$/i);
  if (match) {
    return `${humanizeField(match[1])} deve ser verdadeiro ou falso.`;
  }

  match = trimmed.match(/^(.+) must not be less than ([0-9_]+)$/i);
  if (match) {
    return `${humanizeField(match[1])} deve ser no mínimo ${match[2].replaceAll("_", "")}.`;
  }

  match = trimmed.match(/^(.+) must not be greater than ([0-9_]+)$/i);
  if (match) {
    return `${humanizeField(match[1])} deve ser no máximo ${match[2].replaceAll("_", "")}.`;
  }

  match = trimmed.match(
    /^(.+) must be longer than or equal to ([0-9]+) characters$/i,
  );
  if (match) {
    return `${humanizeField(match[1])} deve ter pelo menos ${match[2]} caracteres.`;
  }

  match = trimmed.match(
    /^(.+) must be shorter than or equal to ([0-9]+) characters$/i,
  );
  if (match) {
    return `${humanizeField(match[1])} deve ter no máximo ${match[2]} caracteres.`;
  }

  match = trimmed.match(
    /^each value in (.+) must be longer than or equal to ([0-9]+) characters$/i,
  );
  if (match) {
    return `Cada item de ${humanizeField(match[1])} deve ter pelo menos ${match[2]} caracteres.`;
  }

  match = trimmed.match(/^(.+) must be one of the following values: (.+)$/i);
  if (match) {
    return `${humanizeField(match[1])} inválido. Valores aceites: ${match[2]}.`;
  }

  match = trimmed.match(/^(.+) must be a valid ISO 8601 date string$/i);
  if (match) {
    return `${humanizeField(match[1])} deve ser uma data válida.`;
  }

  match = trimmed.match(/^(.+) must be a UUID$/i);
  if (match) {
    return `${humanizeField(match[1])} tem formato inválido.`;
  }

  match = trimmed.match(/^(.+) must match .+ regular expression$/i);
  if (match) {
    return `${humanizeField(match[1])} tem formato inválido.`;
  }

  match = trimmed.match(/^Invalid transition from (.+) to (.+)$/i);
  if (match) {
    return `Transição de estado inválida: ${match[1]} -> ${match[2]}.`;
  }

  return null;
}

function humanizeSingleMessage(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  const fromMap = humanMessages[trimmed];
  if (fromMap) {
    return fromMap;
  }

  const fromValidation = humanizeValidationMessage(trimmed);
  if (fromValidation) {
    return fromValidation;
  }

  return trimmed;
}

export function humanizeMessage(input: string): string {
  const parts = splitMessageParts(input);
  if (parts.length === 0) {
    return input.trim();
  }

  const normalized = parts.map((part) => humanizeSingleMessage(part));
  const deduped = normalized.filter(
    (message, index) => normalized.indexOf(message) === index,
  );
  return deduped.join(" ");
}

export function humanizeUnknownError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return humanizeMessage(error.message);
  }

  return fallback;
}

export async function readApiError(response: Response): Promise<string> {
  let detail = `Erro (${response.status}).`;

  try {
    const body = (await response.json()) as ApiErrorBody;
    const message = Array.isArray(body.message)
      ? body.message
          .map((item) => humanizeMessage(item))
          .filter((item) => item.trim().length > 0)
          .join(" ")
      : typeof body.message === "string"
        ? humanizeMessage(body.message)
        : body.error
          ? humanizeMessage(body.error)
          : undefined;

    if (message && message.trim().length > 0) {
      return humanizeMessage(message);
    }
  } catch {
    // Keep fallback if API does not return JSON.
  }

  if (response.status === 400) {
    detail = "Dados inválidos. Revê os campos e tenta novamente.";
  } else if (response.status === 401) {
    detail = "Sessão inválida ou expirada. Faz login novamente.";
  } else if (response.status === 403) {
    detail = "Não tens permissão para executar esta ação.";
  } else if (response.status === 404) {
    detail = "Recurso não encontrado.";
  } else if (response.status === 409) {
    detail = "Conflito de dados. Revê os valores e tenta novamente.";
  } else if (response.status === 429) {
    detail = "Muitas tentativas. Aguarda um pouco e volta a tentar.";
  } else if (response.status >= 500) {
    detail = "Erro interno do servidor. Tenta novamente em instantes.";
  }

  return detail;
}
