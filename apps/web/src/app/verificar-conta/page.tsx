import Link from "next/link";

export default function VerifyAccountPage() {
  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Conta</p>
          <h1>Verificar conta</h1>
          <p className="subtitle">
            A verificação avançada será ativada numa fase seguinte do MVP.
          </p>
        </header>

        <p className="status">
          A tua conta já pode ser usada para explorar e operar os fluxos principais.
        </p>

        <div className="actions actions--inline">
          <Link href="/app" className="primary">
            Ir para a app
          </Link>
          <Link href="/" className="primary primary--ghost">
            Voltar ao início
          </Link>
        </div>
      </section>
    </main>
  );
}
