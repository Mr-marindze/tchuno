'use client';

import { useState } from 'react';
import { clearAuthIntent } from '@/lib/access-control';
import { clearTokens, getStoredTokens, logout } from '@/lib/auth';

type LogoutButtonProps = {
  className?: string;
  label?: string;
  pendingLabel?: string;
};

export function LogoutButton({
  className,
  label = 'Sair',
  pendingLabel = 'A sair...',
}: LogoutButtonProps) {
  const [running, setRunning] = useState(false);

  async function handleLogout() {
    if (running) {
      return;
    }

    setRunning(true);

    try {
      const { refreshToken } = getStoredTokens();
      if (refreshToken) {
        await logout(refreshToken);
      }
    } catch {
      // Continue logout locally even if remote revoke fails.
    } finally {
      clearTokens();
      clearAuthIntent();

      if (typeof window !== 'undefined') {
        window.location.replace('/login?force=1');
      }
    }
  }

  return (
    <button
      type='button'
      className={className}
      onClick={() => {
        void handleLogout();
      }}
      disabled={running}
    >
      {running ? pendingLabel : label}
    </button>
  );
}
