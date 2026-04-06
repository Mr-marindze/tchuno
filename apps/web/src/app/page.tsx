"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { trackEvent } from "@/lib/tracking";
import styles from "./page.module.css";

const heroExamples = [
  "Canalização",
  "Eletricista",
  "Reparações",
  "Construção",
];

const flowSteps = [
  {
    title: "Cria o teu pedido",
    description: "Explica o que precisas, onde e quando queres resolver.",
  },
  {
    title: "Recebe propostas de profissionais reais",
    description: "Compara opções reais com mais contexto e confiança.",
  },
  {
    title: "Escolhe, paga sinal e acompanha a execução",
    description: "O contacto desbloqueia após sinal e o trabalho avança.",
  },
];

const preferredAreaLabels = [
  "Canalização",
  "Eletricista",
  "Reparações Domésticas",
  "Construção",
  "Pintura",
  "Carpintaria",
];

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Home() {
  const router = useRouter();
  const [hasSession] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const accessToken = localStorage.getItem("tchuno_access_token");
    const refreshToken = localStorage.getItem("tchuno_refresh_token");
    return Boolean(accessToken || refreshToken);
  });
  const loginHref = buildAuthRoute({
    mode: "login",
    nextPath: "/app/pedidos",
  });
  const registerHref = buildAuthRoute({
    mode: "register",
    nextPath: "/app/pedidos",
  });
  const { discoveryLoading, marketCategories, trustSummary } =
    useMarketplaceDiscovery();
  const featuredAreas = useMemo(() => {
    const namesBySlug = new Map(
      marketCategories.map((category) => [
        normalizeLabel(category.name),
        category.name,
      ]),
    );
    const areas = preferredAreaLabels.map(
      (label) => namesBySlug.get(normalizeLabel(label)) ?? label,
    );

    return Array.from(new Set(areas)).slice(0, 6);
  }, [marketCategories]);
  const averageRating =
    Number(trustSummary.avgRating) > 0
      ? `${trustSummary.avgRating}/5`
      : "Sem avaliações";

  function goToCreateRequest(input?: {
    selectedService?: string;
    selectedProviderId?: string;
  }): void {
    const nextPath = "/app/pedidos#novo-pedido";

    if (!hasSession) {
      saveAuthIntent({
        nextPath,
        sourcePath: "/",
        selectedService: input?.selectedService,
        selectedProviderId: input?.selectedProviderId,
      });

      router.push(
        buildAuthRoute({
          mode: "login",
          nextPath,
        }),
      );
      return;
    }

    router.push(nextPath);
  }

  function handleHeroCreateRequest(): void {
    trackEvent("marketplace.cta.click", {
      source: "landing.hero",
      view: "landing",
      label: "Criar pedido",
      ctaType: "primary",
      sessionState: hasSession ? "authenticated" : "guest",
      pricingContext: "quote-first",
    });

    goToCreateRequest();
  }

  function handleFinalCreateRequest(): void {
    trackEvent("marketplace.cta.click", {
      source: "landing.final_cta",
      view: "landing",
      label: "Criar pedido",
      ctaType: "primary",
      sessionState: hasSession ? "authenticated" : "guest",
      pricingContext: "quote-first",
    });

    goToCreateRequest();
  }

  return (
    <main className={`shell marketplace-shell ${styles.homePage}`}>
      <section className={`card card--wide ${styles.homeSurface}`}>
        <header className={styles.topBar} aria-label="Navegação principal">
          <Link href="/" className={styles.brandLink}>
            <span className={styles.brandMark}>Tchuno</span>
          </Link>

          <div className={styles.topActions}>
            <Link href={loginHref} className={styles.topActionLink}>
              Entrar
            </Link>
            <Link href={registerHref} className="primary primary--ghost">
              Criar conta
            </Link>
          </div>
        </header>

        <header className={styles.hero} aria-label="Apresentação do Tchuno">
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>O que precisas resolver hoje?</h1>
            <p className={styles.heroSubtitle}>
              Recebe propostas de profissionais perto de ti e escolhe com
              confiança.
            </p>
            <p className={styles.heroFlow}>
              Descreve o serviço. Recebe propostas. Escolhe com confiança.
            </p>

            <div className={styles.heroActions}>
              <button
                type="button"
                className={`primary ${styles.heroPrimary}`}
                onClick={handleHeroCreateRequest}
              >
                Criar pedido
              </button>
              <Link href="/registo" className="primary primary--ghost">
                Quero trabalhar no Tchuno
              </Link>
            </div>

            <p className={styles.heroExamples}>{heroExamples.join(" • ")}</p>
          </div>
        </header>

        <section className={styles.sectionBlock} aria-label="Como funciona">
          <div className={styles.sectionHeader}>
            <p className="kicker">Como funciona</p>
            <h2 className="section-title">Pedido primeiro. Escolha depois.</h2>
          </div>

          <div className={styles.stepGrid}>
            {flowSteps.map((step, index) => (
              <article key={step.title} className={styles.stepCard}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.sectionBlock} aria-label="Confiança">
          <div className={styles.sectionHeader}>
            <p className="kicker">Confiança</p>
            <h2 className="section-title">Indicadores simples para decidir</h2>
          </div>

          <div className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <p className="metric-label">Profissionais disponíveis</p>
              <p className={styles.metricValue}>{trustSummary.totalCount}</p>
            </article>
            <article className={styles.metricCard}>
              <p className="metric-label">Avaliação média</p>
              <p className={styles.metricValue}>{averageRating}</p>
            </article>
            <article className={styles.metricCard}>
              <p className="metric-label">Resposta média estimada</p>
              <p className={styles.metricValue}>{trustSummary.responseEstimate}</p>
            </article>
          </div>
        </section>

        <section className={styles.sectionBlock} aria-label="Áreas do Tchuno">
          <div className={styles.sectionHeader}>
            <p className="kicker">Áreas</p>
            <h2 className="section-title">Áreas onde já podes pedir ajuda</h2>
          </div>

          {discoveryLoading ? (
            <p className="status">A carregar áreas...</p>
          ) : null}

          <div className={styles.areaGrid}>
            {featuredAreas.map((area) => (
              <article key={area} className={styles.areaCard}>
                {area}
              </article>
            ))}
          </div>

          <div className={styles.sectionAction}>
            <Link href="/categorias" className="primary primary--ghost">
              Ver todas as áreas
            </Link>
          </div>
        </section>

        <section className={styles.finalCta} aria-label="Chamadas para ação finais">
          <article className={`${styles.finalCard} ${styles.finalCardPrimary}`}>
            <p className="kicker">Para clientes</p>
            <h2>Precisas de ajuda agora?</h2>
            <p>Cria o teu pedido e recebe propostas sem perder tempo.</p>
            <button type="button" className="primary" onClick={handleFinalCreateRequest}>
              Criar pedido
            </button>
          </article>

          <article className={`${styles.finalCard} ${styles.finalCardSecondary}`}>
            <p className="kicker">Para prestadores</p>
            <h2>Queres ganhar dinheiro com as tuas competências?</h2>
            <p>Cria o teu perfil e começa a receber pedidos na tua área.</p>
            <Link href="/registo" className="primary primary--ghost">
              Criar perfil de prestador
            </Link>
          </article>
        </section>
      </section>
    </main>
  );
}
