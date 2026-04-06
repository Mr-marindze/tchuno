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
  SpotlightCard,
  StatCard,
} from "@/components/public/landing-ui";
import { useMarketplaceDiscovery } from "@/components/marketplace/use-marketplace-discovery";
import { buildAuthRoute, saveAuthIntent } from "@/lib/access-control";
import { trackEvent } from "@/lib/tracking";
import styles from "./page.module.css";

const preferredAreaLabels = [
  "Canalização",
  "Eletricista",
  "Reparações Domésticas",
  "Construção",
  "Pintura",
  "Carpintaria",
];

const areaDescriptions: Record<
  string,
  { description: string; note: string; icon: LandingIconName }
> = {
  canalizacao: {
    description: "Fugas, torneiras, pressão de água e pequenas instalações.",
    note: "Entrada rápida para pedidos urgentes e manutenção.",
    icon: "plumbing",
  },
  eletricista: {
    description: "Tomadas, iluminação, quadros e avarias elétricas.",
    note: "Bom ponto de entrada para problemas domésticos frequentes.",
    icon: "electric",
  },
  "reparacoes domesticas": {
    description: "Pequenos arranjos, manutenção e apoio em casa.",
    note: "Útil para quem ainda está a afinar o tipo exato de serviço.",
    icon: "repairs",
  },
  construcao: {
    description: "Pequenas obras, acabamentos e apoio em remodelação.",
    note: "Ideal para pedidos com mais contexto e comparação de propostas.",
    icon: "construction",
  },
  pintura: {
    description: "Pintura interior, exterior, retoques e acabamento.",
    note: "Ajuda a entrar por descoberta sem escolher profissional cedo demais.",
    icon: "painting",
  },
  carpintaria: {
    description: "Portas, armários, ajustes, roupeiros e trabalhos em madeira.",
    note: "Boa área para pedidos detalhados com necessidade de comparação.",
    icon: "carpentry",
  },
};

const flowSteps = [
  {
    icon: "request" as const,
    eyebrow: "Passo 1",
    title: "Cria o teu pedido",
    description: "Descreve o serviço, a tua zona e o contexto do que precisas resolver.",
  },
  {
    icon: "proposal" as const,
    eyebrow: "Passo 2",
    title: "Recebe propostas de profissionais reais",
    description: "Vês respostas concretas e comparas melhor antes de avançar.",
  },
  {
    icon: "confidence" as const,
    eyebrow: "Passo 3",
    title: "Escolhe e avança com confiança",
    description: "Decides com mais contexto e continuas o fluxo certo do pedido.",
  },
];

const cityPresence = [
  {
    city: "Maputo",
    note: "Maior concentração atual de atividade e pedidos locais.",
  },
  {
    city: "Matola",
    note: "Zona com procura crescente e proximidade operacional forte.",
  },
  {
    city: "Beira",
    note: "Presença em crescimento para pedidos de serviços locais.",
  },
  {
    city: "Nampula",
    note: "Cobertura inicial em evolução, com foco em expansão responsável.",
  },
];

const providerBenefits = [
  "Cria um perfil público consistente com as tuas áreas de serviço.",
  "Recebe pedidos relevantes em vez de depender só de contactos informais.",
  "Constrói reputação com propostas, execução e avaliações dentro da plataforma.",
];

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getAreaConfig(label: string) {
  return (
    areaDescriptions[normalizeLabel(label)] ?? {
      description: "Entra por área e cria um pedido com mais contexto.",
      note: "Estrutura preparada para descoberta mais rica no futuro.",
      icon: "spark" as const,
    }
  );
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

  const { discoveryLoading, marketCategories, trustSummary } =
    useMarketplaceDiscovery();

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
      <div className={styles.pageFrame}>
        <header className={styles.navbar} aria-label="Navegação principal">
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>Tchuno</span>
            <span className={styles.brandCopy}>
              <strong>Serviços locais em Moçambique</strong>
              <span>Marketplace de pedidos e propostas</span>
            </span>
          </Link>

          <nav className={styles.desktopNav}>
            <a href="#servicos">Serviços</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#cobertura">Cobertura</a>
            <a href="#prestadores">Prestadores</a>
          </nav>

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
              onClick={() => goToCreateRequest()}
            >
              Criar pedido
            </button>
            <Link href="/registo" className={`primary primary--ghost ${styles.navGhost}`}>
              Sou prestador
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
            <a href="#servicos" onClick={() => setMobileMenuOpen(false)}>
              Serviços
            </a>
            <a href="#como-funciona" onClick={() => setMobileMenuOpen(false)}>
              Como funciona
            </a>
            <a href="#cobertura" onClick={() => setMobileMenuOpen(false)}>
              Cobertura
            </a>
            <a href="#prestadores" onClick={() => setMobileMenuOpen(false)}>
              Prestadores
            </a>
            <Link href={registerHref} onClick={() => setMobileMenuOpen(false)}>
              Criar conta
            </Link>
            <button
              type="button"
              className={`primary ${styles.mobilePrimary}`}
              onClick={() => {
                setMobileMenuOpen(false);
                goToCreateRequest();
              }}
            >
              Criar pedido
            </button>
            <Link
              href="/registo"
              className={`primary primary--ghost ${styles.mobileGhost}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Quero trabalhar no Tchuno
            </Link>
          </div>
        ) : null}

        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className="kicker">Marketplace moçambicano de serviços locais</p>
            <h1 className={styles.heroTitle}>O que precisas resolver hoje?</h1>
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
              <Link href="/registo" className={`primary primary--ghost ${styles.heroGhost}`}>
                Quero trabalhar no Tchuno
              </Link>
            </div>

            <div className={styles.quickAreas}>
              <div className={styles.quickAreasHead}>
                <p className={styles.quickAreasTitle}>Categorias rápidas</p>
                <span>{discoveryLoading ? "A carregar áreas..." : "Escolhe uma área para começar"}</span>
              </div>

              <div className={styles.quickAreasGrid}>
                {landingAreas.map((area) => (
                  <QuickAreaChip
                    key={area}
                    icon={getAreaConfig(area).icon}
                    label={area}
                    onClick={() => handleAreaShortcut(area)}
                  />
                ))}
              </div>
            </div>
          </div>

          <aside className={styles.heroPreview} aria-label="Pré-visualização do fluxo">
            <div className={styles.previewRequest}>
              <p className={styles.previewEyebrow}>Exemplo de pedido</p>
              <h2>Entraste por categoria, explicaste o serviço e o pedido ficou pronto.</h2>
              <div className={styles.previewTags}>
                <span>Serviço local</span>
                <span>Zona do pedido</span>
                <span>Contexto claro</span>
              </div>
            </div>

            <div className={styles.previewStack}>
              <article className={styles.previewCard}>
                <span className={styles.previewIcon}>
                  <LandingIcon name="proposal" />
                </span>
                <div>
                  <strong>Recebes propostas</strong>
                  <p>Compara especialidade, disponibilidade e reputação antes de decidir.</p>
                </div>
              </article>

              <article className={styles.previewCard}>
                <span className={styles.previewIcon}>
                  <LandingIcon name="confidence" />
                </span>
                <div>
                  <strong>Escolhes com contexto</strong>
                  <p>O pedido continua organizado sem te empurrar para contratação direta.</p>
                </div>
              </article>

              <article className={styles.previewCard}>
                <span className={styles.previewIcon}>
                  <LandingIcon name="spark" />
                </span>
                <div>
                  <strong>Avanças no fluxo certo</strong>
                  <p>Da proposta à execução, a experiência continua coerente com o produto.</p>
                </div>
              </article>
            </div>
          </aside>
        </section>

        <section id="servicos" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <p className="kicker">Descoberta</p>
              <h2 className="section-title">Serviços mais procurados</h2>
            </div>
            <p className={styles.sectionLead}>
              Entradas rápidas para quem já sabe a área do serviço e quer avançar sem perder tempo.
            </p>
          </div>

          <div className={styles.spotlightGrid}>
            {landingAreas.map((area) => {
              const config = getAreaConfig(area);

              return (
                <SpotlightCard
                  key={area}
                  icon={config.icon}
                  eyebrow="Área popular"
                  title={area}
                  description={config.description}
                  note={config.note}
                  action={
                    <button
                      type="button"
                      className={`primary primary--ghost ${styles.cardActionButton}`}
                      onClick={() => handleAreaShortcut(area)}
                    >
                      Criar pedido
                    </button>
                  }
                />
              );
            })}
          </div>
        </section>

        <section id="como-funciona" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <p className="kicker">Fluxo</p>
              <h2 className="section-title">Como funciona</h2>
            </div>
            <p className={styles.sectionLead}>
              Uma única explicação clara para o utilizador perceber o próximo passo em segundos.
            </p>
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

        <section id="cobertura" className={`${styles.section} ${styles.coverageSection}`}>
          <div className={styles.coverageIntro}>
            <p className="kicker">Cobertura</p>
            <h2 className="section-title">Onde o Tchuno está a crescer</h2>
            <p className={styles.sectionLead}>
              Começamos por zonas com mais atividade e continuamos a expandir de forma responsável.
            </p>
            <div className={styles.coverageHighlight}>
              <span className={styles.coverageIcon}>
                <LandingIcon name="location" />
              </span>
              <div>
                <strong>Presença geográfica em evolução</strong>
                <p>
                  Mostramos cidades onde a procura e a oferta já começam a ganhar ritmo.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.cityGrid}>
            {cityPresence.map((item) => (
              <article key={item.city} className={styles.cityCard}>
                <p className={styles.cityName}>{item.city}</p>
                <p className={styles.cityNote}>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <p className="kicker">Confiança</p>
              <h2 className="section-title">Sinais rápidos para decidir melhor</h2>
            </div>
            <p className={styles.sectionLead}>
              Informação curta, honesta e escaneável para dar mais confiança sem poluir a página.
            </p>
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
              note="Média baseada nas avaliações públicas já existentes."
            />
            <StatCard
              icon="clock"
              label="Resposta média estimada"
              value={trustSummary.responseEstimate}
              note="Estimativa simples com base na atividade disponível."
            />
          </div>
        </section>

        <section id="prestadores" className={`${styles.section} ${styles.providerSection}`}>
          <div className={styles.providerContent}>
            <p className="kicker">Para prestadores</p>
            <h2 className="section-title">Transforma competências locais em pedidos relevantes</h2>
            <p className={styles.sectionLead}>
              Qualquer profissional de serviços locais pode criar perfil e começar a crescer com a plataforma.
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
              <Link href="/prestadores" className="primary primary--ghost">
                Ver perfis públicos
              </Link>
            </div>
          </div>

          <div className={styles.providerAside}>
            <SpotlightCard
              icon="provider"
              eyebrow="Perfil + pedidos"
              title="Uma presença pública mais organizada"
              description="O teu perfil ajuda clientes a perceber onde ativas, o que fazes e porque vale a pena receberem a tua proposta."
              note="Estrutura pronta para evoluir reputação, relevância e descoberta."
            />
          </div>
        </section>

        <section className={styles.finalBanner}>
          <div>
            <p className="kicker">Próximo passo</p>
            <h2>Precisas de ajuda agora?</h2>
            <p>
              Entra pela área certa, cria o pedido e recebe propostas dentro do fluxo oficial do Tchuno.
            </p>
          </div>
          <div className={styles.finalBannerActions}>
            <button
              type="button"
              className={`primary ${styles.finalPrimary}`}
              onClick={handleFinalCreateRequest}
            >
              Criar pedido
            </button>
            <Link href="/registo" className={styles.finalSecondaryLink}>
              Sou prestador
            </Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <span className={styles.footerBrandMark}>Tchuno</span>
            <p>
              Marketplace moçambicano de serviços locais com foco em pedido,
              propostas e escolha com confiança.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <FooterLinkGroup
              title="Plataforma"
              links={[
                { href: "/sobre", label: "Sobre" },
                { href: "/como-funciona", label: "Como funciona" },
                { href: "/categorias", label: "Áreas" },
              ]}
            />
            <FooterLinkGroup
              title="Clientes"
              links={[
                { href: loginHref, label: "Criar pedido" },
                { href: "/prestadores", label: "Descobrir perfis" },
                { href: "/faq", label: "Ajuda" },
              ]}
            />
            <FooterLinkGroup
              title="Prestadores"
              links={[
                { href: "/registo", label: "Criar perfil" },
                { href: "/prestadores", label: "Perfis públicos" },
                { href: "/contacto", label: "Falar com a equipa" },
              ]}
            />
          </div>
        </footer>
      </div>
    </main>
  );
}
