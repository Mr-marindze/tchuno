import { apiFetch, API_URL } from "@/lib/auth";
import { parseApiError, readApiError, toApiError } from "@/lib/http-errors";

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ListCategoriesQuery = {
  includeInactive?: boolean;
};

export type CreateCategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
};

export type AdminRequestOptions = {
  reauthToken?: string;
};

export async function listCategories(
  query?: ListCategoriesQuery,
): Promise<Category[]> {
  const params = new URLSearchParams();
  if (query?.includeInactive) {
    params.set("includeInactive", "true");
  }

  const path = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`${API_URL}/categories${path}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as Category[];
}

export async function createCategory(
  accessToken: string,
  input: CreateCategoryInput,
  options?: AdminRequestOptions,
): Promise<Category> {
  const response = await apiFetch(`${API_URL}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options?.reauthToken
        ? {
            "x-reauth-token": options.reauthToken,
          }
        : {}),
    },
    body: JSON.stringify(input),
    accessToken,
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }

  return (await response.json()) as Category;
}

export async function deactivateCategory(
  accessToken: string,
  categoryId: string,
  options?: AdminRequestOptions,
): Promise<void> {
  const response = await apiFetch(`${API_URL}/categories/${categoryId}`, {
    method: "DELETE",
    headers: {
      ...(options?.reauthToken
        ? {
            "x-reauth-token": options.reauthToken,
          }
        : {}),
    },
    accessToken,
  });

  if (!response.ok) {
    throw toApiError(await parseApiError(response));
  }
}
