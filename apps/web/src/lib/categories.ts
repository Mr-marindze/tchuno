import { API_URL } from "@/lib/auth";

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

type ApiErrorBody = {
  message?: string | string[];
};

async function readError(response: Response): Promise<string> {
  let detail = `Request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      detail = body.message.join(", ");
    } else if (body.message) {
      detail = body.message;
    }
  } catch {
    // Keep fallback detail if API does not return JSON.
  }

  return detail;
}

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
    throw new Error(await readError(response));
  }

  return (await response.json()) as Category[];
}

export async function createCategory(
  accessToken: string,
  input: CreateCategoryInput,
): Promise<Category> {
  const response = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as Category;
}

export async function deactivateCategory(
  accessToken: string,
  categoryId: string,
): Promise<void> {
  const response = await fetch(`${API_URL}/categories/${categoryId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}
