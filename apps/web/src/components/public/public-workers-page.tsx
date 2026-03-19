"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatRatingValue,
  formatStars,
  shortenId,
} from "@/components/dashboard/dashboard-formatters";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  buildWorkerRankingContext,
  getWorkerComparisonItems,
  getWorkerCtaCopy,
  getWorkerDecisionBadges,
  getWorkerMainCategoryLabel,
  getWorkerPriceLabel,
  getWorkerResponseEtaLabel,
  getWorkerReviewLabel,
} from "@/components/marketplace/marketplace-worker-presenter";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { listCategories, Category } from "@/lib/categories";
import { humanizeUnknownError } from "@/lib/http-errors";
import { trackEvent } from "@/lib/tracking";
import { listWorkerProfiles, WorkerProfile } from "@/lib/worker-profile";

export function PublicWorkersPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("A carregar prestadores...");
  const [search, setSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialCategory = params.get("categoria") ?? "";
    setCategorySlug(initialCategory);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    setHasSession(Boolean(accessToken || refreshToken));
  }, []);

  useEffect(() => {
    let active = true;

    async function loadFilters() {
      try {
        const response = await listCategories();
        if (!active) {
          return;
        }

        const activeCategories = response
          .filter((item) => item.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        setCategories(activeCategories);
      } catch {
        // keep page operational without category list
      }
    }

    void loadFilters();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWorkers() {
      setLoading(true);
      setStatus("A carregar prestadores...");

      try {
        const response = await listWorkerProfiles({
          isAvailable: true,
          search: search.trim() || undefined,
          categorySlug: categorySlug || undefined,
          sort: "rating:desc",
          page: 1,
          limit: 24,
        });

        if (!active) {
          return;
        }

        setWorkers(response.data);
        setStatus(
          response.data.length > 0
            ? `${response.data.length} prestadores encontrados.`
            : "Sem resultados para estes filtros.",
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(
          humanizeUnknownError(
            error,
            "Não foi possível carregar prestadores neste momento.",
          ),
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWorkers();

    return () => {
      active = false;
    };
  }, [categorySlug, search]);

  const ranking = useMemo(() => buildWorkerRankingContext(workers), [workers]);

  function redirectToLogin(worker?: WorkerProfile) {
    const nextPath = "/app/pedidos#job-create";

    saveAuthIntent({
      nextPath,
      sourcePath: "/prestadores",
      selectedProviderId: worker?.id,
      selectedService: search.trim() || categorySlug || undefined,
    });

    router.push(
      buildAuthRoute({
        mode: "login",
        nextPath,
      }),
    );
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    trackEvent("marketplace.search.change", {
      source: "landing.discovery",
      view: "landing",
      queryLength: search.trim().length,
      hasCategoryFilter: categorySlug.length > 0,
      resultCount: workers.length,
    });
  }

  return (
    <PublicPageShell
      title="Prestadores"
      description="Compara reputação, disponibilidade e preço antes de pedir serviço."
    >
      <form className="actions actions--inline" onSubmit={onSearchSubmit}>
        <label>
          Pesquisa
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar por localização, categoria ou perfil"
          />
        </label>

        <label>
          Categoria
          <select
            value={categorySlug}
            onChange={(event) => setCategorySlug(event.target.value)}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="primary">
          Atualizar lista
        </button>
      </form>

      <p className="status">{status}</p>

      {loading ? (
        <p className="status">Aguarda um instante...</p>
      ) : workers.length === 0 ? (
        <div className="marketplace-empty-state">
          <p className="empty-state">
            Sem prestadores para este filtro. Tenta outra categoria ou limpa a pesquisa.
          </p>
          <div className="actions actions--inline">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategorySlug("");
              }}
            >
              Limpar filtros
            </button>
            <Link href="/categorias" className="primary primary--ghost">
              Ver categorias
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel-grid marketplace-worker-grid">
          {workers.map((worker) => {
            const hasHourlyRate = typeof worker.hourlyRate === "number";
            const ratingValue = Number(worker.ratingAvg || 0);
            const rankingLabel =
              ranking.rankingLabelById[worker.id] ?? "Relevante nesta lista";
            const decisionBadges = getWorkerDecisionBadges({
              isAvailable: worker.isAvailable,
              ratingValue,
              ratingCount: worker.ratingCount,
              experienceYears: worker.experienceYears,
              hourlyRate: worker.hourlyRate,
              ratingRank: ranking.ratingRankById[worker.id] ?? null,
              priceRank: ranking.priceRankById[worker.id] ?? null,
              rankingLabel,
              scoreBreakdown: ranking.scoreBreakdownById[worker.id] ?? null,
            });
            const comparisonItems = getWorkerComparisonItems({
              isAvailable: worker.isAvailable,
              ratingValue,
              ratingCount: worker.ratingCount,
              experienceYears: worker.experienceYears,
              hourlyRate: worker.hourlyRate,
              ratingRank: ranking.ratingRankById[worker.id] ?? null,
              priceRank: ranking.priceRankById[worker.id] ?? null,
            });
            const ctaCopy = getWorkerCtaCopy({
              isAvailable: worker.isAvailable,
              hasHourlyRate,
            });
            const reviewLabel = getWorkerReviewLabel(worker.ratingCount);
            const categoryLabel = getWorkerMainCategoryLabel(worker);
            const responseEta = getWorkerResponseEtaLabel({
              isAvailable: worker.isAvailable,
              ratingValue,
              ratingCount: worker.ratingCount,
              experienceYears: worker.experienceYears,
              hourlyRate: worker.hourlyRate,
              ratingRank: ranking.ratingRankById[worker.id] ?? null,
              priceRank: ranking.priceRankById[worker.id] ?? null,
            });

            return (
              <MarketplaceWorkerCard
                key={worker.id}
                title={`Profissional ${shortenId(worker.userId)}`}
                highlighted={ranking.strongHighlightById[worker.id] ?? false}
                relevanceLabel={rankingLabel}
                availabilityTone={worker.isAvailable ? "is-ok" : "is-muted"}
                availabilityLabel={
                  worker.isAvailable ? "Disponível hoje" : "Agenda limitada"
                }
                responseTimeLabel={responseEta}
                rating={{
                  stars: formatStars(worker.ratingAvg),
                  value: formatRatingValue(worker.ratingAvg),
                  reviewCount: worker.ratingCount,
                }}
                comparisonItems={comparisonItems}
                trustSignals={[
                  {
                    label: "Reputação",
                    value:
                      worker.ratingCount > 0 ? reviewLabel : "Sem avaliações ainda",
                  },
                  {
                    label: "Categoria",
                    value: categoryLabel,
                  },
                ]}
                badges={
                  <>
                    {decisionBadges.map((badge) => (
                      <span key={badge.label} className={`status-pill ${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                  </>
                }
                details={[
                  {
                    label: "Preço",
                    value: getWorkerPriceLabel(worker.hourlyRate),
                  },
                  {
                    label: "Localização",
                    value: worker.location ?? "Não indicada",
                  },
                  {
                    label: "Categoria",
                    value: categoryLabel,
                  },
                ]}
                note={worker.bio ?? undefined}
                ctaHint={
                  hasSession
                    ? ctaCopy.helperText
                    : "Faz login para pedir serviço e continuar deste ponto sem perder o contexto."
                }
                actions={
                  <>
                    {hasSession ? (
                      <Link href="/app/pedidos#job-create" className="primary">
                        {ctaCopy.primaryLabel}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => redirectToLogin(worker)}
                      >
                        Entrar para pedir serviço
                      </button>
                    )}
                    <Link
                      href={`/prestadores/${worker.userId}`}
                      className="primary primary--ghost"
                    >
                      Ver perfil
                    </Link>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </PublicPageShell>
  );
}
