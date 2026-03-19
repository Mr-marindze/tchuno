"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatRatingValue,
  formatStars,
} from "@/components/dashboard/dashboard-formatters";
import { MarketplaceWorkerCard } from "@/components/marketplace/marketplace-worker-card";
import {
  buildWorkerRankingContext,
  getWorkerCtaCopy,
  getWorkerDecisionBadges,
  getWorkerMainCategoryLabel,
  getWorkerPriceLabel,
  getWorkerResponseEtaLabel,
} from "@/components/marketplace/marketplace-worker-presenter";
import { PublicPageShell } from "@/components/public/public-page-shell";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { listCategories, Category } from "@/lib/categories";
import { humanizeUnknownError } from "@/lib/http-errors";
import { trackEvent } from "@/lib/tracking";
import {
  listWorkerProfiles,
  resolveWorkerDisplayName,
  WorkerProfile,
} from "@/lib/worker-profile";

export function PublicWorkersPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("A carregar profissionais...");
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [availability, setAvailability] = useState<"all" | "available">("all");
  const [hasSession] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    return Boolean(accessToken || refreshToken);
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialCategory = params.get("categoria") ?? "";
    setCategorySlug(initialCategory);
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
      setStatus("A carregar profissionais...");

      const combinedSearch = [search.trim(), locationSearch.trim()]
        .filter((value) => value.length > 0)
        .join(" ");

      try {
        const response = await listWorkerProfiles({
          isAvailable: availability === "available" ? true : undefined,
          search: combinedSearch || undefined,
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
            ? `${response.data.length} profissionais encontrados.`
            : "Sem resultados para estes filtros.",
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(
          humanizeUnknownError(
            error,
            "Não foi possível carregar profissionais neste momento.",
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
  }, [availability, categorySlug, locationSearch, search]);

  const ranking = useMemo(() => buildWorkerRankingContext(workers), [workers]);
  const promotedCategories = useMemo(() => categories.slice(0, 6), [categories]);
  const selectedCategoryName = useMemo(
    () => categories.find((category) => category.slug === categorySlug)?.name ?? null,
    [categories, categorySlug],
  );
  const searchPlaceholder = selectedCategoryName
    ? `Pesquisar dentro de ${selectedCategoryName}`
    : "Procurar serviço, área ou profissional";

  function redirectToLogin(worker?: WorkerProfile) {
    const nextPath = "/app/pedidos#job-create";

    saveAuthIntent({
      nextPath,
      sourcePath: "/prestadores",
      selectedProviderId: worker?.id,
      selectedService:
        search.trim() || locationSearch.trim() || categorySlug || undefined,
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
    const combinedSearch = [search.trim(), locationSearch.trim()]
      .filter((value) => value.length > 0)
      .join(" ");
    trackEvent("marketplace.search.change", {
      source: "landing.discovery",
      view: "landing",
      queryLength: combinedSearch.length,
      hasCategoryFilter: categorySlug.length > 0,
      resultCount: workers.length,
    });
  }

  return (
    <PublicPageShell
      title="Profissionais"
      description="Pesquisa por serviço, área ou profissional em várias áreas e escolhe com confiança."
    >
      <p className="marketplace-signal-note">
        No Tchuno, o valor final é negociado entre cliente e profissional.
      </p>

      <form className="section-toolbar marketplace-search-toolbar" onSubmit={onSearchSubmit}>
        <label>
          Pesquisa
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>

        <label>
          Área
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

        <label>
          Local
          <input
            type="search"
            value={locationSearch}
            onChange={(event) => setLocationSearch(event.target.value)}
            placeholder="Ex.: Maputo, Matola, Beira"
          />
        </label>

        <label>
          Disponibilidade
          <select
            value={availability}
            onChange={(event) =>
              setAvailability(event.target.value as "all" | "available")
            }
          >
            <option value="all">Todos</option>
            <option value="available">Disponível hoje</option>
          </select>
        </label>

        <div className="actions actions--inline">
          <button type="submit" className="primary">
            Procurar
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setLocationSearch("");
              setCategorySlug("");
              setAvailability("all");
            }}
          >
            Limpar
          </button>
        </div>
      </form>

      {promotedCategories.length > 0 ? (
        <div className="dashboard-nav marketplace-chip-grid" aria-label="Áreas populares">
          {promotedCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`marketplace-chip${
                categorySlug === category.slug ? " is-active" : ""
              }`}
              onClick={() =>
                setCategorySlug((current) =>
                  current === category.slug ? "" : category.slug,
                )
              }
            >
              {category.name}
            </button>
          ))}
        </div>
      ) : null}

      {selectedCategoryName ? (
        <p className="marketplace-signal-note">
          Pesquisa dentro desta área: <strong>{selectedCategoryName}</strong>
        </p>
      ) : null}

      <p className="status">{status}</p>

      {loading ? (
        <p className="status">Aguarda um instante...</p>
      ) : workers.length === 0 ? (
        <div className="marketplace-empty-state">
          <p className="empty-state">
            Não encontrámos profissionais para este filtro. Tenta outra área ou limpa a pesquisa.
          </p>
          <div className="actions actions--inline">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setLocationSearch("");
                setCategorySlug("");
                setAvailability("all");
              }}
            >
              Limpar filtros
            </button>
            <Link href="/categorias" className="primary primary--ghost">
              Ver categorias
            </Link>
          </div>
          <p className="muted">
            Sugestão: tenta remover o filtro de disponibilidade ou pesquisar por uma área mais ampla.
          </p>
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
            const ctaCopy = getWorkerCtaCopy({
              isAvailable: worker.isAvailable,
              hasHourlyRate,
            });
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
            const workerTitle = resolveWorkerDisplayName(worker);

            return (
              <MarketplaceWorkerCard
                key={worker.id}
                title={workerTitle}
                highlighted={ranking.strongHighlightById[worker.id] ?? false}
                relevanceLabel={
                  ranking.strongHighlightById[worker.id] ? rankingLabel : undefined
                }
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
                trustSignals={[
                  {
                    label: "Especialidade",
                    value: categoryLabel,
                  },
                  {
                    label: "Localização",
                    value: worker.location ?? "Não indicada",
                  },
                ]}
                badges={
                  <>
                    {decisionBadges.slice(0, 1).map((badge) => (
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
                ]}
                ctaHint={
                  hasSession
                    ? "Valor combinado diretamente entre cliente e profissional."
                    : "Faz login para pedir serviço sem perder o contexto da tua pesquisa."
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
