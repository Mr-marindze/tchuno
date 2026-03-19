"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listCategories, Category } from "@/lib/categories";
import { humanizeUnknownError } from "@/lib/http-errors";
import { PublicPageShell } from "@/components/public/public-page-shell";

export function PublicCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("A carregar categorias...");

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setLoading(true);
      setStatus("A carregar categorias...");

      try {
        const data = await listCategories();
        if (!active) {
          return;
        }

        const activeCategories = data
          .filter((category) => category.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        setCategories(activeCategories);
        setStatus(
          activeCategories.length > 0
            ? `${activeCategories.length} categorias disponíveis.`
            : "Ainda não existem categorias ativas.",
        );
      } catch (error) {
        if (!active) {
          return;
        }
        setStatus(
          humanizeUnknownError(error, "Não foi possível carregar categorias."),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      active = false;
    };
  }, []);

  return (
    <PublicPageShell
      title="Categorias"
      description="Explora serviços disponíveis antes de iniciar sessão."
    >
      <p className="status">{status}</p>

      {loading ? (
        <p className="status">Aguarda um instante...</p>
      ) : categories.length === 0 ? (
        <div className="marketplace-empty-state">
          <p className="empty-state">
            Não existem categorias ativas neste momento.
          </p>
        </div>
      ) : (
        <div className="panel-grid">
          {categories.map((category) => (
            <article key={category.id} className="panel-card">
              <h2>{category.name}</h2>
              <p className="subtitle">
                {category.description ?? "Serviços disponíveis nesta categoria."}
              </p>
              <div className="actions actions--inline">
                <Link
                  href={`/prestadores?categoria=${encodeURIComponent(category.slug)}`}
                  className="primary"
                >
                  Ver prestadores
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </PublicPageShell>
  );
}
