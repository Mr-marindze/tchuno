'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  clearTokens,
  ensureSession,
  getStoredTokens,
  listSessions,
  logout,
  revokeSession,
} from '@/lib/auth';
import { humanizeUnknownError } from '@/lib/http-errors';

type SessionItem = {
  id: string;
  deviceId: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  revokedAt: string | null;
};

export default function CustomerProfilePage() {
  const router = useRouter();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [name, setName] = useState('Utilizador');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState(false);
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
            setAccessToken(null);
            setSessions([]);
          }
          return;
        }

        const token = session.auth.accessToken;
        const mePayload = session.me as
          | {
              user?: {
                name?: string | null;
                email?: string | null;
                phone?: string | null;
              };
            }
          | undefined;

        const sessionsResponse = await listSessions(token, {
          status: 'active',
          limit: 10,
          offset: 0,
          sort: 'lastUsedAt:desc',
        });

        if (!active) {
          return;
        }

        setAccessToken(token);
        setName(mePayload?.user?.name ?? session.auth.user.name ?? 'Utilizador');
        setEmail(mePayload?.user?.email ?? session.auth.user.email ?? '');
        setPhone(mePayload?.user?.phone ?? null);
        setSessions(sessionsResponse.data as SessionItem[]);
        setStatus('Perfil carregado com sucesso.');
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar perfil.'));
          setSessions([]);
        }
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

  async function handleRevokeSession(sessionId: string) {
    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    setRunningAction(true);
    setStatus('A revogar sessão...');

    try {
      await revokeSession(accessToken, sessionId);
      const updated = await listSessions(accessToken, {
        status: 'active',
        limit: 10,
        offset: 0,
        sort: 'lastUsedAt:desc',
      });
      setSessions(updated.data as SessionItem[]);
      setStatus('Sessão revogada com sucesso.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao revogar sessão.'));
    } finally {
      setRunningAction(false);
    }
  }

  async function handleLogout() {
    setRunningAction(true);
    setStatus('A terminar sessão...');

    try {
      const { refreshToken } = getStoredTokens();
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
      // Continue logout locally even if remote token revoke fails.
    } finally {
      clearTokens();
      router.replace('/login');
      setRunningAction(false);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Perfil</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Dados da conta, sessões ativas e saída segura.
            </p>
          </div>
          <button
            type='button'
            className='inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100'
          >
            Editar perfil
          </button>
        </div>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
          Dados pessoais
        </p>
        <dl className='mt-3 space-y-2 text-sm text-slate-700'>
          <div>
            <dt className='inline font-medium text-slate-900'>Nome:</dt>{' '}
            <dd className='inline'>{name || 'n/d'}</dd>
          </div>
          <div>
            <dt className='inline font-medium text-slate-900'>Email:</dt>{' '}
            <dd className='inline'>{email || 'n/d'}</dd>
          </div>
          <div>
            <dt className='inline font-medium text-slate-900'>Telefone:</dt>{' '}
            <dd className='inline'>{phone || 'n/d'}</dd>
          </div>
        </dl>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
          Sessões ativas
        </p>

        {sessions.length === 0 ? (
          <p className='mt-3 text-sm text-slate-600'>Sem sessões ativas listadas.</p>
        ) : (
          <div className='mt-3 space-y-3'>
            {sessions.map((session) => (
              <article
                key={session.id}
                className='rounded-xl border border-slate-200 bg-slate-50 p-3'
              >
                <p className='text-sm font-semibold text-slate-900'>
                  {session.deviceId}
                </p>
                <p className='mt-1 text-xs text-slate-600'>
                  Último uso: {new Date(session.lastUsedAt).toLocaleString('pt-PT')}
                </p>
                <p className='text-xs text-slate-600'>IP: {session.ip ?? 'n/d'}</p>
                <button
                  type='button'
                  className='mt-3 inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60'
                  onClick={() => {
                    void handleRevokeSession(session.id);
                  }}
                  disabled={runningAction}
                >
                  Revogar sessão
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <button
          type='button'
          className='inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
          onClick={() => {
            void handleLogout();
          }}
          disabled={runningAction}
        >
          Logout
        </button>
      </section>
    </main>
  );
}
