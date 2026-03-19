import Link from "next/link";

export default function RecoverPasswordPage() {
  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Conta</p>
          <h1>Recuperar senha</h1>
          <p className="subtitle">
            No MVP, a recuperação é assistida pela equipa de operação.
          </p>
        </header>

        <p className="status">
          Contacta o suporte interno para redefinir a senha em segurança.
        </p>

        <div className="actions actions--inline">
          <Link href="/login" className="primary">
            Voltar ao login
          </Link>
          <Link href="/contacto" className="primary primary--ghost">
            Ir para contacto
          </Link>
        </div>
      </section>
    </main>
  );
}
