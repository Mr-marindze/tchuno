import Link from "next/link";
import { ReactNode } from "react";
import { buildAuthRoute } from "@/lib/access-control";

type PublicPageShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PublicPageShell({
  title,
  description,
  children,
}: PublicPageShellProps) {
  const loginHref = buildAuthRoute({
    mode: "login",
    nextPath: "/app/pedidos",
  });
  const createRequestHref = buildAuthRoute({
    mode: "login",
    nextPath: "/app/pedidos#novo-pedido",
  });

  return (
    <main className="shell">
      <section className="card card--wide">
        <header className="header">
          <p className="kicker">Tchuno</p>
          <h1>{title}</h1>
          <p className="subtitle">{description}</p>
        </header>

        <nav className="dashboard-nav" aria-label="Navegação pública">
          <Link href="/">Início</Link>
          <Link href="/como-funciona">Como funciona</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/faq">Ajuda</Link>
          <Link href="/sobre">Sobre</Link>
          <Link href="/registo">Trabalhar no Tchuno</Link>
          <Link href={loginHref}>Entrar</Link>
          <Link href={createRequestHref}>Criar pedido</Link>
        </nav>

        <section className="marketplace-section">{children}</section>
      </section>
    </main>
  );
}
