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
  getWorkerMainCategoryLabel,
  getWorkerPriceLabel,
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

type TrustSignalTone = "is-ok" | "is-muted" | "is-danger";

type WorkerTrustIndicator = {
  label:
    | "Responde rápido"
    | "Alta taxa de resposta"
    | "Mais escolhido"
    | "Disponível hoje";
  tone: TrustSignalTone;
};

const suggestedSearches = [
  "Explicador",
  "Advogado",
  "Designer",
  "Fotógrafo",
];

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
            ? `${response.data.length} perfis disponíveis para receber pedido.`
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
    ? `Filtrar perfis em ${selectedCategoryName}`
    : "Filtra por área, zona ou nome";
  const orderedWorkers = useMemo(() => {
    return [...workers].sort((a, b) => {
      const scoreDiff =
        (ranking.relevanceScoreById[b.id] ?? 0) -
        (ranking.relevanceScoreById[a.id] ?? 0);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return Number(b.ratingAvg || 0) - Number(a.ratingAvg || 0);
    });
  }, [workers, ranking.relevanceScoreById]);
  const recommendedWorker = orderedWorkers[0] ?? null;
  const listWorkers = recommendedWorker
    ? orderedWorkers.filter((worker) => worker.id !== recommendedWorker.id)
    : orderedWorkers;
  const searchContextTitle = useMemo(() => {
    const contextTokens = [
      search.trim(),
      locationSearch.trim(),
      selectedCategoryName ?? "",
    ].filter((value) => value.length > 0);

    if (contextTokens.length === 0) {
      return "Perfis públicos para orientar o teu pedido";
    }

    return `Resultados para ${contextTokens.join(" • ")}`;
  }, [locationSearch, search, selectedCategoryName]);

  function redirectToLogin(worker?: WorkerProfile) {
    const nextPath = "/app/pedidos#novo-pedido";

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

  function getPrimaryCtaLabel(): string {
    return "Criar pedido";
  }

  function getGuestCtaLabel(): string {
    return "Entrar para criar pedido";
  }

  function getTrustIndicator(worker: WorkerProfile): WorkerTrustIndicator {
    const ratingValue = Number(worker.ratingAvg || 0);
    const rankingLabel = ranking.rankingLabelById[worker.id] ?? "";
    const relevanceRank = ranking.relevanceRankById[worker.id] ?? Number.MAX_SAFE_INTEGER;

    if (rankingLabel === "Mais procurado" || relevanceRank === 1) {
      return { label: "Mais escolhido", tone: "is-ok" };
    }

    if (worker.isAvailable && worker.ratingCount >= 6) {
      return { label: "Alta taxa de resposta", tone: "is-ok" };
    }

    if (
      worker.isAvailable &&
      (worker.experienceYears >= 4 || (worker.ratingCount >= 3 && ratingValue >= 4.4))
    ) {
      return { label: "Responde rápido", tone: "is-ok" };
    }

    if (worker.isAvailable) {
      return { label: "Disponível hoje", tone: "is-ok" };
    }

    return { label: "Mais escolhido", tone: "is-muted" };
  }

  function renderWorkerCard(worker: WorkerProfile, options?: { featured?: boolean }) {
    const trustIndicator = getTrustIndicator(worker);
    const workerTitle = resolveWorkerDisplayName(worker);
    const isFeatured = options?.featured ?? false;

    return (
      <MarketplaceWorkerCard
        key={worker.id}
        className={isFeatured ? "marketplace-worker-card--featured" : undefined}
        title={workerTitle}
        avatarFallbackLabel={workerTitle}
        highlighted={isFeatured}
        relevanceLabel={isFeatured ? "Recomendado para si" : undefined}
        availabilityTone={worker.isAvailable ? "is-ok" : "is-muted"}
        availabilityLabel={worker.isAvailable ? "Disponível hoje" : "Agenda limitada"}
        rating={{
          stars: formatStars(worker.ratingAvg),
          value: formatRatingValue(worker.ratingAvg),
          reviewCount: worker.ratingCount,
        }}
        trustSignals={[
          {
            label: "Especialidade",
            value: getWorkerMainCategoryLabel(worker),
          },
        ]}
        details={[
          {
            label: "Localização",
            value: worker.location ?? "Não indicada",
          },
          {
            label: "Preço",
            value: getWorkerPriceLabel(worker.hourlyRate),
          },
        ]}
        badges={
          <span className={`status-pill ${trustIndicator.tone}`}>
            {trustIndicator.label}
          </span>
        }
        actions={
          hasSession ? (
            <Link href="/app/pedidos#novo-pedido" className="primary">
              {getPrimaryCtaLabel()}
            </Link>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={() => redirectToLogin(worker)}
            >
              {getGuestCtaLabel()}
            </button>
          )
        }
        footer={
          <Link
            href={`/prestadores/${worker.userId}`}
            className="marketplace-inline-link"
          >
            Ver perfil
          </Link>
        }
        onCardClick={() => {
          trackEvent("marketplace.worker.card.click", {
            source: "landing.worker_card",
            view: "landing",
            workerId: worker.id,
            highlighted: isFeatured,
            relevanceLabel: ranking.rankingLabelById[worker.id] ?? null,
          });
          router.push(`/prestadores/${worker.userId}`);
        }}
      />
    );
  }

  return (
    <PublicPageShell
      title="Profissionais"
      description="Usa perfis públicos como referência e cria um pedido para receber propostas dentro do fluxo oficial."
    >
      <p className="marketplace-signal-note">
        No Tchuno, os perfis públicos ajudam-te a perceber quem atua na tua zona. A escolha acontece depois de criares pedido e receberes propostas.
      </p>

      <form className="section-toolbar marketplace-search-toolbar" onSubmit={onSearchSubmit}>
        <label>
          Filtro rápido
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
            Atualizar perfis
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
          A mostrar perfis nesta área: <strong>{selectedCategoryName}</strong>
        </p>
      ) : null}

      <div className="marketplace-results-header">
        <h2 className="section-title">{searchContextTitle}</h2>
        <p className="section-lead">
          Usa estes sinais como contexto. Para avançar, cria pedido e recebe propostas alinhadas com o teu serviço.
        </p>
      </div>

      <p className="status">{status}</p>

      {loading ? (
        <p className="status">Aguarda um instante...</p>
      ) : workers.length === 0 ? (
        <div className="marketplace-empty-state">
          <p className="empty-state">
            Não encontrámos perfis para este filtro. Tenta outra área ou cria pedido para receber propostas mesmo sem escolher já um profissional.
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
            <Link href="/login?next=%2Fapp%2Fpedidos%23novo-pedido" className="primary primary--ghost">
              Criar pedido
            </Link>
          </div>
          <div
            className="dashboard-nav marketplace-chip-grid"
            aria-label="Sugestões rápidas"
          >
            {promotedCategories.slice(0, 4).map((category) => (
              <button
                key={category.id}
                type="button"
                className="marketplace-chip"
                onClick={() => {
                  setCategorySlug(category.slug);
                  trackEvent("marketplace.category.select", {
                    source: "landing.discovery",
                    view: "landing",
                    categorySlug: category.slug,
                    previousCategorySlug: null,
                    categoryCount: promotedCategories.length,
                    resultCount: 0,
                  });
                }}
              >
                {category.name}
              </button>
            ))}
            {suggestedSearches.map((term) => (
              <button
                key={term}
                type="button"
                className="marketplace-chip"
                onClick={() => {
                  setSearch(term);
                  setCategorySlug("");
                  trackEvent("marketplace.search.change", {
                    source: "landing.discovery",
                    view: "landing",
                    queryLength: term.length,
                    hasCategoryFilter: false,
                    resultCount: 0,
                  });
                }}
              >
                {term}
              </button>
            ))}
          </div>
          <p className="muted">
            Sugestão: tenta remover o filtro de disponibilidade ou pesquisar por uma área mais ampla.
          </p>
        </div>
      ) : (
        <>
          {recommendedWorker ? (
            <section
              className="marketplace-featured-block"
              aria-label="Profissional recomendado"
            >
              <p className="kicker">Mais escolhido</p>
              <h3 className="item-title">Recomendado para si</h3>
              <p className="muted">
                Perfil com melhor equilíbrio entre reputação, disponibilidade e
                interesse nesta pesquisa.
              </p>
              {renderWorkerCard(recommendedWorker, { featured: true })}
            </section>
          ) : null}

          {listWorkers.length > 0 ? (
            <div className="panel-grid marketplace-worker-grid">
              {listWorkers.map((worker) => renderWorkerCard(worker))}
            </div>
          ) : null}
        </>
      )}
    </PublicPageShell>
  );
}
