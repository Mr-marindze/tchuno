import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">403</p>
          <h1>Acesso proibido</h1>
          <p className="subtitle">
            Não tens permissão para abrir esta área.
          </p>
        </header>

        <div className="actions actions--inline">
          <Link href="/" className="primary">
            Voltar ao início
          </Link>
          <Link href="/login" className="primary primary--ghost">
            Entrar com outra conta
          </Link>
        </div>
      </section>
    </main>
  );
}
