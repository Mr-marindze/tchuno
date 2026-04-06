'use client';

import Link from 'next/link';
import {
  ProviderInboxNotification,
  ProviderInboxNotificationTone,
} from '@/lib/provider-inbox';

function toneClasses(tone: ProviderInboxNotificationTone): string {
  if (tone === 'attention') {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }

  if (tone === 'muted') {
    return 'border-slate-200 bg-slate-50 text-slate-800';
  }

  return 'border-blue-200 bg-blue-50 text-blue-900';
}

export function ProviderInboxNotifications(input: {
  title: string;
  subtitle: string;
  items: ProviderInboxNotification[];
  emptyLabel: string;
}) {
  return (
    <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5'>
      <h2 className='text-lg font-semibold text-slate-900'>{input.title}</h2>
      <p className='mt-1 text-sm text-slate-600'>{input.subtitle}</p>

      {input.items.length === 0 ? (
        <p className='mt-3 text-sm text-slate-500'>{input.emptyLabel}</p>
      ) : (
        <div className='mt-4 grid gap-3 lg:grid-cols-2'>
          {input.items.map((item) => (
            <article
              key={item.id}
              className={`rounded-2xl border p-4 shadow-sm ${toneClasses(item.tone)}`}
            >
              <h3 className='text-sm font-semibold'>{item.title}</h3>
              <p className='mt-1 text-sm opacity-90'>{item.description}</p>
              <Link
                href={item.href}
                className='mt-3 inline-flex items-center rounded-lg bg-white/80 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white'
              >
                {item.hrefLabel}
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
