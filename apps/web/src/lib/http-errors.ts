type ApiErrorBody = {
  message?: string | string[];
  error?: string;
};

const humanMessages: Record<string, string> = {
  "Invalid credentials": "Email ou password inválidos.",
  "Refresh token is required": "Sessão expirada. Faz login novamente.",
  "Invalid refresh token": "Sessão inválida. Faz login novamente.",
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
};

export function humanizeMessage(input: string): string {
  const trimmed = input.trim();
  return humanMessages[trimmed] ?? trimmed;
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
    const message =
      Array.isArray(body.message) && body.message.length > 0
        ? body.message.join(", ")
        : typeof body.message === "string"
          ? body.message
          : body.error;

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
