import Link from "next/link";
import { ReactNode } from "react";

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
          <Link href="/categorias">Categorias</Link>
          <Link href="/prestadores">Prestadores</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/sobre">Sobre</Link>
          <Link href="/contacto">Contacto</Link>
          <Link href="/login">Entrar</Link>
        </nav>

        <section className="marketplace-section">{children}</section>
      </section>
    </main>
  );
}
