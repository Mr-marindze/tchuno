'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ensureSession } from '@/lib/auth';
import { listCategories, Category } from '@/lib/categories';
import { humanizeUnknownError } from '@/lib/http-errors';
import {
  getMyWorkerProfile,
  resolveWorkerDisplayName,
  upsertMyWorkerProfile,
  WorkerProfile,
} from '@/lib/worker-profile';

const availabilityStatusLabel: Record<
  WorkerProfile['availabilityStatus'],
  string
> = {
  AVAILABLE_NOW: 'Disponível agora',
  LIMITED_THIS_WEEK: 'Agenda limitada esta semana',
  NEXT_WEEK: 'Disponível na próxima semana',
  UNAVAILABLE: 'Indisponível',
};

export default function ProviderProfilePage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('A carregar perfil profissional...');

  const [publicName, setPublicName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityStatus, setAvailabilityStatus] =
    useState<WorkerProfile['availabilityStatus']>('AVAILABLE_NOW');
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
        setPublicName(myProfile?.publicName ?? '');
        setBio(myProfile?.bio ?? '');
        setLocation(myProfile?.location ?? '');
        setServiceAreas(myProfile?.serviceAreaPreferences.join(', ') ?? '');
        setHourlyRate(
          typeof myProfile?.hourlyRate === 'number' ? String(myProfile.hourlyRate) : '',
        );
        setExperienceYears(String(myProfile?.experienceYears ?? 0));
        setIsAvailable(myProfile?.isAvailable ?? true);
        setAvailabilityStatus(myProfile?.availabilityStatus ?? 'AVAILABLE_NOW');
        setCategoryIds(myProfile?.categories.map((category) => category.id) ?? []);
        setStatus('Perfil profissional carregado.');
      } catch (error) {
        if (active) {
          setStatus(humanizeUnknownError(error, 'Falha ao carregar perfil.'));
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

  const profileName = useMemo(() => {
    if (!profile) {
      return 'Prestador';
    }
    return resolveWorkerDisplayName(profile, 'Prestador');
  }, [profile]);

  function toggleCategory(categoryId: string, checked: boolean) {
    setCategoryIds((current) => {
      if (checked) {
        return current.includes(categoryId) ? current : [...current, categoryId];
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
    const normalizedServiceAreas = serviceAreas
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (
      hourlyRate.trim().length > 0 &&
      (!Number.isFinite(parsedHourlyRate) || parsedHourlyRate < 0)
    ) {
      setStatus('Tarifa/hora inválida.');
      return;
    }

    if (!Number.isFinite(parsedExperienceYears) || parsedExperienceYears < 0) {
      setStatus('Anos de experiência inválidos.');
      return;
    }

    setSaving(true);
    setStatus('A guardar perfil profissional...');

    try {
      const updated = await upsertMyWorkerProfile(accessToken, {
        publicName: publicName.trim().length > 0 ? publicName.trim() : undefined,
        bio: bio.trim().length > 0 ? bio.trim() : undefined,
        location: location.trim().length > 0 ? location.trim() : undefined,
        serviceAreaPreferences: normalizedServiceAreas,
        hourlyRate:
          hourlyRate.trim().length > 0 ? Math.trunc(parsedHourlyRate) : undefined,
        experienceYears: Math.trunc(parsedExperienceYears),
        isAvailable,
        availabilityStatus,
        categoryIds,
      });

      setProfile(updated);
      setPublicName(updated.publicName ?? '');
      setServiceAreas(updated.serviceAreaPreferences.join(', '));
      setAvailabilityStatus(updated.availabilityStatus);
      setIsAvailable(updated.isAvailable);
      setStatus('Perfil profissional atualizado.');
    } catch (error) {
      setStatus(humanizeUnknownError(error, 'Falha ao guardar perfil.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className='space-y-4'>
      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6'>
        <h1 className='text-2xl font-semibold text-slate-900'>Perfil profissional</h1>
        <p className='mt-1 text-sm text-slate-600'>
          Mantem disponibilidade, zonas preferidas, categorias e dados publicos sempre atualizados.
        </p>

        <p className={`mt-4 text-sm ${loading ? 'text-blue-700' : 'text-slate-600'}`}>
          {status}
        </p>

        <div className='mt-4 grid gap-3 sm:grid-cols-3'>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs text-slate-500'>Nome público</p>
            <p className='mt-1 font-semibold text-slate-900'>{profileName}</p>
          </article>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs text-slate-500'>Rating</p>
            <p className='mt-1 font-semibold text-slate-900'>
              {profile?.ratingAvg ?? '0.0'} ({profile?.ratingCount ?? 0})
            </p>
          </article>
          <article className='rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <p className='text-xs text-slate-500'>Disponibilidade</p>
            <p className='mt-1 font-semibold text-slate-900'>
              {availabilityStatusLabel[availabilityStatus]}
            </p>
          </article>
        </div>
      </section>

      <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
        <form className='space-y-4' onSubmit={handleSubmit}>
          <label className='block space-y-1 text-sm text-slate-700'>
            <span>Nome público</span>
            <input
              type='text'
              value={publicName}
              onChange={(event) => setPublicName(event.target.value)}
              maxLength={80}
              placeholder='Ex.: João Canalizações'
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            />
            <span className='block text-xs text-slate-500'>
              Este nome aparece no catálogo e no teu perfil público. Se deixares vazio,
              usamos o nome da tua conta.
            </span>
          </label>

          <label className='block space-y-1 text-sm text-slate-700'>
            <span>Bio</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={1000}
              className='min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            />
          </label>

          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='block space-y-1 text-sm text-slate-700'>
              <span>Localização</span>
              <input
                type='text'
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={240}
                className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              />
            </label>

            <label className='block space-y-1 text-sm text-slate-700'>
              <span>Tarifa/hora (MZN)</span>
              <input
                type='number'
                min={0}
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
                className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              />
            </label>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='block space-y-1 text-sm text-slate-700'>
              <span>Anos de experiência</span>
              <input
                type='number'
                min={0}
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
                className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              />
            </label>

            <label className='block space-y-1 text-sm text-slate-700'>
              <span>Estado de disponibilidade</span>
              <select
                value={availabilityStatus}
                onChange={(event) => {
                  const nextValue =
                    event.target.value as WorkerProfile['availabilityStatus'];
                  setAvailabilityStatus(nextValue);
                  setIsAvailable(nextValue !== 'UNAVAILABLE');
                }}
                className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
              >
                <option value='AVAILABLE_NOW'>Disponível agora</option>
                <option value='LIMITED_THIS_WEEK'>
                  Agenda limitada esta semana
                </option>
                <option value='NEXT_WEEK'>Disponível na próxima semana</option>
                <option value='UNAVAILABLE'>Indisponível</option>
              </select>
              <span className='block text-xs text-slate-500'>
                Isto ajuda a priorizar melhor os pedidos na tua inbox.
              </span>
            </label>
          </div>

          <label className='block space-y-1 text-sm text-slate-700'>
            <span>Zonas preferidas de serviço</span>
            <input
              type='text'
              value={serviceAreas}
              onChange={(event) => setServiceAreas(event.target.value)}
              maxLength={400}
              placeholder='Ex.: Matola, Maputo, Boane'
              className='w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500'
            />
            <span className='block text-xs text-slate-500'>
              Separa por vírgulas as cidades, bairros ou zonas onde preferes
              responder primeiro.
            </span>
          </label>

          <fieldset>
            <legend className='text-sm font-medium text-slate-700'>Categorias</legend>
            <div className='mt-2 grid gap-2 sm:grid-cols-2'>
              {categories.map((category) => (
                <label
                  key={category.id}
                  className='inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700'
                >
                  <input
                    type='checkbox'
                    checked={categoryIds.includes(category.id)}
                    onChange={(event) =>
                      toggleCategory(category.id, event.target.checked)
                    }
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type='submit'
            className='inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60'
            disabled={saving}
          >
            {saving ? 'A guardar...' : 'Guardar perfil'}
          </button>
        </form>
      </section>
    </main>
  );
}
