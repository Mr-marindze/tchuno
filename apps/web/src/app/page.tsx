"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FooterLinkGroup,
  FlowCard,
  LandingIcon,
  QuickAreaChip,
  type LandingIconName,
  StatCard,
} from "@/components/public/landing-ui";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { trackEvent } from "@/lib/tracking";
import styles from "./page.module.css";

const preferredAreaLabels = [
  "Canalização",
  "Eletricista",
  "Reparações",
  "Construção",
  "Pintura",
  "Carpintaria",
];

const flowSteps = [
  {
    icon: "request" as const,
    eyebrow: "Passo 1",
    title: "Cria o teu pedido",
    description: "Descreve o que precisas, onde e quando.",
  },
  {
    icon: "proposal" as const,
    eyebrow: "Passo 2",
    title: "Recebe propostas",
    description: "Profissionais respondem ao teu pedido.",
  },
  {
    icon: "confidence" as const,
    eyebrow: "Passo 3",
    title: "Escolhe e avança",
    description: "Comparas as propostas, escolhes a melhor e continuas com segurança.",
  },
];

const providerBenefits = [
  "Cria perfil e mostra as tuas áreas de serviço.",
  "Recebe pedidos relevantes sem depender só de contactos informais.",
  "Cresce com reputação, propostas e execução dentro da plataforma.",
];

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAreaIcon(label: string): LandingIconName {
  const normalized = normalizeLabel(label);

  if (normalized.includes("canal")) {
    return "plumbing";
  }

  if (normalized.includes("eletric")) {
    return "electric";
  }

  if (normalized.includes("repar")) {
    return "repairs";
  }

  if (normalized.includes("constr")) {
    return "construction";
  }

  if (normalized.includes("pint")) {
    return "painting";
  }

  if (normalized.includes("carp")) {
    return "carpentry";
  }

  return "spark";
}

export default function Home() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const { marketCategories, trustSummary } = useMarketplaceDiscovery();

  const landingAreas = useMemo(() => {
    const namesBySlug = new Map(
      marketCategories.map((category) => [
        normalizeLabel(category.name),
        category.name,
      ]),
    );

    return preferredAreaLabels.map(
      (label) => namesBySlug.get(normalizeLabel(label)) ?? label,
    );
  }, [marketCategories]);

  const averageRating =
    Number(trustSummary.avgRating) > 0
      ? `${trustSummary.avgRating}/5`
      : "Sem avaliações";

  function goToCreateRequest(input?: { selectedService?: string }) {
    const nextPath = "/app/pedidos#novo-pedido";

    if (!hasSession) {
      saveAuthIntent({
        nextPath,
        sourcePath: "/",
        selectedService: input?.selectedService,
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

  function handleHeroCreateRequest() {
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

  function handleFinalCreateRequest() {
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

  function handleAreaShortcut(area: string) {
    goToCreateRequest({ selectedService: area });
  }

  return (
    <main className={`shell marketplace-shell ${styles.page}`}>
      <div className={styles.frame}>
        <header className={styles.navbar} aria-label="Navegação principal">
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>Tchuno</span>
            <span className={styles.brandCopy}>
              <strong>Serviços locais em Moçambique</strong>
              <span>Pedido primeiro. Propostas depois.</span>
            </span>
          </Link>

          <div className={styles.desktopActions}>
            <Link href={loginHref} className={styles.navLink}>
              Entrar
            </Link>
            <Link href={registerHref} className={styles.navLink}>
              Criar conta
            </Link>
            <button
              type="button"
              className={`primary ${styles.navPrimary}`}
              onClick={handleHeroCreateRequest}
            >
              Criar pedido
            </button>
            <Link href="/registo" className={styles.navSecondary}>
              Trabalhar no Tchuno
            </Link>
          </div>

          <div className={styles.mobileActions}>
            <Link href={loginHref} className={styles.navLink}>
              Entrar
            </Link>
            <button
              type="button"
              className={styles.menuToggle}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMobileMenuOpen((current) => !current)}
            >
              <LandingIcon name="menu" />
            </button>
          </div>
        </header>

        {mobileMenuOpen ? (
          <div id="landing-mobile-menu" className={styles.mobileMenu}>
            <Link href={registerHref} onClick={() => setMobileMenuOpen(false)}>
              Criar conta
            </Link>
            <button
              type="button"
              className={`primary ${styles.mobilePrimary}`}
              onClick={() => {
                setMobileMenuOpen(false);
                handleHeroCreateRequest();
              }}
            >
              Criar pedido
            </button>
            <Link
              href="/registo"
              className={styles.mobileSecondary}
              onClick={() => setMobileMenuOpen(false)}
            >
              Trabalhar no Tchuno
            </Link>
          </div>
        ) : null}

        <section className={styles.hero} aria-label="Apresentação do Tchuno">
          <div className={styles.heroContent}>
            <p className="kicker">Marketplace moçambicano de serviços locais</p>
            <h1 className={styles.heroTitle}>
              Resolve serviços locais sem perder tempo.
            </h1>
            <p className={styles.heroSubtitle}>
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
            </div>

            <div className={styles.heroChips}>
              {landingAreas.map((area) => (
                <QuickAreaChip
                  key={area}
                  icon={getAreaIcon(area)}
                  label={area}
                  onClick={() => handleAreaShortcut(area)}
                />
              ))}
            </div>
          </div>

          <aside className={styles.heroPreview} aria-label="Resumo visual do fluxo">
            <article className={styles.previewCardPrimary}>
              <p className={styles.previewEyebrow}>Pedido</p>
              <h2>Explicas o serviço uma vez e o fluxo começa aí.</h2>
            </article>

            <article className={styles.previewCard}>
              <span className={styles.previewIcon}>
                <LandingIcon name="proposal" />
              </span>
              <div>
                <strong>Propostas reais</strong>
                <p>Profissionais respondem ao teu pedido com mais contexto.</p>
              </div>
            </article>

            <article className={styles.previewCard}>
              <span className={styles.previewIcon}>
                <LandingIcon name="confidence" />
              </span>
              <div>
                <strong>Escolha com confiança</strong>
                <p>Comparas antes de avançar e o pedido continua organizado.</p>
              </div>
            </article>
          </aside>
        </section>

        <section id="como-funciona" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className="kicker">Como funciona</p>
            <h2 className="section-title">Uma única explicação clara do fluxo</h2>
          </div>

          <div className={styles.flowGrid}>
            {flowSteps.map((step) => (
              <FlowCard
                key={step.title}
                icon={step.icon}
                eyebrow={step.eyebrow}
                title={step.title}
                description={step.description}
              />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className="kicker">Confiança</p>
            <h2 className="section-title">Sinais rápidos para decidir melhor</h2>
          </div>

          <div className={styles.statsGrid}>
            <StatCard
              icon="workers"
              label="Profissionais disponíveis"
              value={String(trustSummary.totalCount)}
              note="Perfis com disponibilidade ativa no marketplace."
            />
            <StatCard
              icon="rating"
              label="Avaliação média"
              value={averageRating}
              note="Baseada nas avaliações públicas já disponíveis."
            />
            <StatCard
              icon="clock"
              label="Resposta média estimada"
              value={trustSummary.responseEstimate}
              note="Estimativa simples com base na atividade atual."
            />
          </div>
        </section>

        <section id="prestadores" className={`${styles.section} ${styles.providerSection}`}>
          <div className={styles.providerContent}>
            <p className="kicker">Para prestadores</p>
            <h2 className="section-title">
              Ganha dinheiro com as tuas competências.
            </h2>
            <p className={styles.providerLead}>
              Cria perfil, recebe pedidos relevantes e cresce com a plataforma.
            </p>

            <ul className={styles.providerList}>
              {providerBenefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className={styles.providerActions}>
              <Link href="/registo" className="primary">
                Criar perfil de prestador
              </Link>
            </div>
          </div>

          <aside className={styles.providerCard}>
            <span className={styles.providerCardIcon}>
              <LandingIcon name="provider" />
            </span>
            <strong>Perfil público simples, pedidos relevantes e reputação em evolução.</strong>
            <p>
              O lado do prestador continua claro e presente, mas sem roubar foco ao
              pedido do cliente.
            </p>
          </aside>
        </section>

        <section className={styles.finalCta}>
          <p className="kicker">Pronto para começar?</p>
          <h2>Precisas de ajuda agora?</h2>
          <p>Cria o teu pedido e recebe propostas.</p>
          <button
            type="button"
            className={`primary ${styles.finalPrimary}`}
            onClick={handleFinalCreateRequest}
          >
            Criar pedido
          </button>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <span className={styles.footerBrandMark}>Tchuno</span>
            <p>
              Pede serviços locais em Moçambique, recebe propostas e escolhe com
              mais confiança.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <FooterLinkGroup
              title="Tchuno"
              links={[
                { href: "/sobre", label: "Sobre" },
                { href: "/como-funciona", label: "Como funciona" },
              ]}
            />
            <FooterLinkGroup
              title="Para clientes"
              links={[
                { href: loginHref, label: "Criar pedido" },
                { href: "/faq", label: "Ajuda" },
              ]}
            />
            <FooterLinkGroup
              title="Para prestadores"
              links={[
                { href: "/registo", label: "Trabalhar no Tchuno" },
                { href: registerHref, label: "Criar conta" },
              ]}
            />
            <FooterLinkGroup
              title="Legal"
              links={[
                { href: "/termos", label: "Termos" },
                { href: "/privacidade", label: "Privacidade" },
                { href: "/contacto", label: "Suporte" },
              ]}
            />
          </div>
        </footer>
      </div>
    </main>
  );
}
