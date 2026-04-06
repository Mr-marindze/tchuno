'use client';

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordRecovery } from "@/lib/auth";
import { humanizeUnknownError } from "@/lib/http-errors";

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(
    "Indica o email da tua conta para pedires ajuda com a recuperação.",
  );
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus("Indica um email válido.");
      return;
    }

    setIsSubmitting(true);
    setStatus("A enviar pedido de recuperação...");

    try {
      const response = await requestPasswordRecovery(normalizedEmail);
      setSubmitted(true);
      setStatus(response.message);
    } catch (error) {
      setStatus(
        humanizeUnknownError(error, "Falha ao enviar pedido de recuperação."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="card">
        <header className="header">
          <p className="kicker">Conta</p>
          <h1>Recuperar senha</h1>
          <p className="subtitle">
            Se perdeste o acesso, envia o teu email e a equipa ajuda a recuperar a
            conta com segurança.
          </p>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email da conta
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@exemplo.com"
              required
            />
          </label>

          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting ? "A enviar..." : "Pedir ajuda para recuperar senha"}
          </button>
        </form>

        <p className="status">{status}</p>

        <div className="actions actions--inline">
          <Link href="/login?force=1" className="primary primary--ghost">
            Voltar ao login
          </Link>
          <Link href="/contacto" className="nav-link">
            Falar com suporte
          </Link>
        </div>

        {submitted ? (
          <p className="status">
            Se o email estiver ligado a uma conta, o pedido fica disponível para a
            equipa de suporte tratar.
          </p>
        ) : null}
      </section>
    </main>
  );
}
