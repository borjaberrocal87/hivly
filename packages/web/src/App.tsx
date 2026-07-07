// App root (Story 2.4, AC5/AC6). Holds client-side UI state: auth state, the
// authenticated user profile, the active screen, and the theme (via useTheme).
//
// Real session flow (replaces the Story 2.2 mock): on mount it calls GET
// /api/auth/me. While that resolves it shows a neutral loading state (NOT the
// login screen — that would flash for authenticated users on every reload). 200 →
// authed (render the shell); 401/null → anon (render LoginScreen). onLogin does a
// full-page navigation to /api/auth/login so the browser leaves the SPA for the
// Discord round-trip. onLogout POSTs /api/auth/logout then returns to the login
// screen. Display data (community name, user) comes from real data / build config.
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { AuthMeResponse } from '@hivly/shared/schemas';

import { fetchMe, logout as apiLogout, LOGIN_URL } from './api/auth';
import { AppLayout } from './components/AppLayout';
import { LoginScreen } from './components/LoginScreen';
import type { Screen } from './components/Sidebar';
import { useTheme } from './hooks/useTheme';
import { initialsFromUsername } from './lib/initials';
import './styles/components.css';

type AuthState = 'loading' | 'anon' | 'authed';

// Community name is build-time config (AD-3: the static SPA can't read the server
// YAML). Real message stats arrive in Epic 4 — keep a neutral placeholder, not
// fake numbers.
const COMMUNITY_NAME = import.meta.env.VITE_COMMUNITY_NAME ?? 'Hivly';
const STATS_LINE = 'indexación de conocimiento · pgvector';

export function App(): ReactElement {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<AuthMeResponse | null>(null);
  const [screen, setScreen] = useState<Screen>('search');
  const { theme, toggleTheme } = useTheme();

  // On mount: resolve the session. A stale/absent cookie yields 401 → anon.
  useEffect(() => {
    let active = true;
    fetchMe()
      .then((profile) => {
        if (!active) return;
        if (profile) {
          setUser(profile);
          setAuthState('authed');
        } else {
          setAuthState('anon');
        }
      })
      .catch(() => {
        // A network/server error is treated as unauthenticated — never hang on loading.
        if (active) setAuthState('anon');
      });
    return () => {
      active = false;
    };
  }, []);

  // Full-page navigation: the browser must leave the SPA so Discord can redirect back.
  const login = useCallback(() => {
    window.location.href = LOGIN_URL;
  }, []);

  const logout = useCallback(() => {
    void apiLogout()
      .then(() => {
        setUser(null);
        setAuthState('anon');
        setScreen('search');
      })
      .catch(() => {
        // Network/server error during logout: keep the authed state so the user can
        // retry or close the tab. The server-side session remains valid.
        console.error('[web] logout request failed');
      });
  }, []);

  if (authState === 'loading') {
    return <LoadingSplash />;
  }

  if (authState === 'anon' || user === null) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <AppLayout
      activeScreen={screen}
      onNavigate={setScreen}
      communityName={COMMUNITY_NAME}
      statsLine={STATS_LINE}
      user={{ name: user.username, initials: initialsFromUsername(user.username) }}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={logout}
      guildId={user.guildId}
    />
  );
}

// Neutral splash shown while GET /api/auth/me is in flight, so the login screen
// never flashes before the session check resolves.
function LoadingSplash(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-deep)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          border: '2px solid var(--border-strong)',
          borderTopColor: '#5865F2',
          borderRadius: '50%',
          animation: 'kh-spin 0.7s linear infinite',
        }}
      />
    </div>
  );
}
