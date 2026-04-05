'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { listCategories, Category } from '@/lib/categories';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  getMyWorkerProfile,
  upsertMyWorkerProfile,
  WorkerProfile,
} from '@/lib/worker-profile';

export default function ProviderProfilePage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('A carregar perfil profissional...');

  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [isAvailable, setIsAvailable] = useState(true);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setStatus('A carregar perfil profissional...');

      try {
        const session = await ensureSession();
        if (!session?.auth.accessToken) {
          if (active) {
            setStatus('Sessão inválida. Faz login novamente.');
          }
          return;
        }

        const token = session.auth.accessToken;
        const [allCategories, myProfile] = await Promise.all([
          listCategories(),
          getMyWorkerProfile(token),
        ]);

        if (!active) {
          return;
        }

        const activeCategories = allCategories.filter((item) => item.isActive);

        setAccessToken(token);
        setCategories(activeCategories);
        setProfile(myProfile);
        setBio(myProfile?.bio ?? '');
        setLocation(myProfile?.location ?? '');
        setHourlyRate(
          typeof myProfile?.hourlyRate === 'number' ? String(myProfile.hourlyRate) : '',
        );
        setExperienceYears(String(myProfile?.experienceYears ?? 0));
        setIsAvailable(myProfile?.isAvailable ?? true);
        setCategoryIds(myProfile?.categories.map((item) => item.id) ?? []);
        setStatus('Perfil profissional carregado.');
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus(humanizeUnknownError(error, 'Falha ao carregar perfil profissional.'));
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

  const profileName = useMemo(() => {
    if (!profile) {
      return 'Prestador';
    }

    return profile.displayName ?? profile.publicName ?? profile.name ?? 'Prestador';
  }, [profile]);

  function toggleCategory(categoryId: string, checked: boolean) {
    setCategoryIds((current) => {
      if (checked) {
        if (current.includes(categoryId)) {
          return current;
        }

        return [...current, categoryId];
      }

      return current.filter((item) => item !== categoryId);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setStatus('Sessão inválida. Faz login novamente.');
      return;
    }

    const parsedHourlyRate = Number(hourlyRate);
    const parsedExperienceYears = Number(experienceYears);

    if (hourlyRate.trim().length > 0 && (!Number.isFinite(parsedHourlyRate) || parsedHourlyRate < 0)) {
      setStatus('Tarifa/hora inválida.');
      return;
    }

    if (!Number.isFinite(parsedExperienceYears) || parsedExperienceYears < 0) {
      setStatus('Experiência inválida.');
      return;
    }

    setSaving(true);
    setStatus('A guardar perfil profissional...');

    try {
      const updated = await upsertMyWorkerProfile(accessToken, {
        bio: bio.trim().length > 0 ? bio.trim() : undefined,
        location: location.trim().length > 0 ? location.trim() : undefined,
        hourlyRate:
          hourlyRate.trim().length > 0 ? Math.trunc(parsedHourlyRate) : undefined,
        experienceYears: Math.trunc(parsedExperienceYears),
        isAvailable,
        categoryIds,
      });

      setProfile(updated);
      setStatus('Perfil profissional atualizado com sucesso.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao guardar perfil profissional.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className='shell'>
      <section className='card'>
        <header className='header'>
          <p className='kicker'>Prestador</p>
          <h1>Perfil Profissional</h1>
          <p className='subtitle'>
            Mantém o teu perfil atualizado para receber propostas alinhadas com a tua disponibilidade.
          </p>
        </header>

        <p className={loading ? 'status status--loading' : 'status'}>{status}</p>

        <article className='list-item'>
          <p>
            <strong>Nome:</strong> {profileName}
          </p>
          <p>
            <strong>Rating:</strong> {profile?.ratingAvg ?? '0.0'} ({profile?.ratingCount ?? 0})
          </p>
          <p>
            <strong>Última atualização:</strong>{' '}
            {profile?.updatedAt
              ? new Date(profile.updatedAt).toLocaleString('pt-PT')
              : 'n/a'}
          </p>
        </article>

        <form className='form' onSubmit={handleSubmit}>
          <label>
            Bio
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={1000}
            />
          </label>

          <label>
            Localização
            <input
              type='text'
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={240}
            />
          </label>

          <label>
            Tarifa por hora (MZN)
            <input
              type='number'
              min={0}
              value={hourlyRate}
              onChange={(event) => setHourlyRate(event.target.value)}
            />
          </label>

          <label>
            Anos de experiência
            <input
              type='number'
              min={0}
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
            />
          </label>

          <label className='inline-check'>
            <input
              type='checkbox'
              checked={isAvailable}
              onChange={(event) => setIsAvailable(event.target.checked)}
            />
            Disponível para novos pedidos
          </label>

          <fieldset>
            <legend>Categorias</legend>
            <div className='checklist'>
              {categories.map((category) => (
                <label key={category.id} className='inline-check'>
                  <input
                    type='checkbox'
                    checked={categoryIds.includes(category.id)}
                    onChange={(event) => toggleCategory(category.id, event.target.checked)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>

          <div className='actions actions--inline'>
            <button type='submit' className='primary' disabled={saving}>
              {saving ? 'A guardar...' : 'Guardar perfil'}
            </button>
            <Link href='/pro/pedidos' className='primary primary--ghost'>
              Voltar aos pedidos
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
