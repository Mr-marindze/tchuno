'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';

export default function CustomerProfilePage() {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('CUSTOMER');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('A carregar perfil...');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar perfil...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
          }
          return;
        }

        if (!active) {
          return;
        }

        setName(session.auth.user.name ?? 'Utilizador');
        setEmail(session.auth.user.email);
        setRole(session.auth.user.role);
        setStatus('Perfil carregado com sucesso.');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar perfil.'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className='shell'>
      <section className='card'>
        <header className='header'>
          <p className='kicker'>Conta</p>
          <h1>Perfil</h1>
          <p className='subtitle'>Dados da tua conta cliente no fluxo oficial do Tchuno.</p>
        </header>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        <div className='list'>
          <article className='list-item'>
            <p>
              <strong>Nome:</strong> {name || 'n/a'}
            </p>
            <p>
              <strong>Email:</strong> {email || 'n/a'}
            </p>
            <p>
              <strong>Role:</strong> {role}
            </p>
          </article>
        </div>

        <div className='actions actions--inline'>
          <Link href='/app/pedidos' className='primary'>
            Voltar aos pedidos
          </Link>
          <Link href='/app/pagamentos' className='primary primary--ghost'>
            Ver pagamentos
          </Link>
        </div>
      </section>
    </main>
  );
}
