// App root (Story 2.2, AC1/2/5/6/7). Holds client-side UI state: auth flag,
// in-flight login flag, active screen, and the theme (via useTheme). Renders the
// LoginScreen when unauthenticated, otherwise the AppLayout shell.
//
// SCOPE: auth is client-side/mock only here. login() runs a ~1100ms setTimeout
// (mirrors the prototype; lets the loading state be seen/tested) and flips a
// boolean — there is no backend call yet. Story 2.3 adds Discord OAuth2 + Redis
// sessions; Story 2.4 replaces this mock with a real GET /api/auth/me check on
// mount + route protection, and wires communityName/statsLine/user from real
// data. Keeping auth/login/logout in this root and passing display data as props
// lets 2.4 swap the mock for a fetch without restructuring the components.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { AppLayout } from './components/AppLayout';
import { LoginScreen } from './components/LoginScreen';
import type { Screen } from './components/Sidebar';
import { useTheme } from './hooks/useTheme';
import './styles/components.css';

export const MOCK_LOGIN_DELAY_MS = 1100;

// Placeholder display data — wired to real data in Story 2.4 / Epic 4.
const COMMUNITY_NAME = 'Aurora Labs';
const STATS_LINE = '12.847 mensajes · 4 canales · pgvector';
const USER = { name: 'Vos', initials: 'VO' };

export function App(): ReactElement {
  const [authed, setAuthed] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [screen, setScreen] = useState<Screen>('search');
  const { theme, toggleTheme } = useTheme();
  const loginTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const login = useCallback(() => {
    setLoggingIn(true);
    loginTimer.current = setTimeout(() => {
      setAuthed(true);
      setLoggingIn(false);
      loginTimer.current = null;
    }, MOCK_LOGIN_DELAY_MS);
  }, []);

  const logout = useCallback(() => {
    if (loginTimer.current) {
      clearTimeout(loginTimer.current);
      loginTimer.current = null;
    }
    setAuthed(false);
    setLoggingIn(false);
    setScreen('search');
  }, []);

  // Cleanup: clear the pending login timer on unmount to avoid a stale
  // setState callback on a removed component (Story 2.2 code review, P1).
  useEffect(() => {
    return () => {
      if (loginTimer.current) {
        clearTimeout(loginTimer.current);
      }
    };
  }, []);

  if (!authed) {
    return <LoginScreen loggingIn={loggingIn} onLogin={login} />;
  }

  return (
    <AppLayout
      activeScreen={screen}
      onNavigate={setScreen}
      communityName={COMMUNITY_NAME}
      statsLine={STATS_LINE}
      user={USER}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={logout}
    />
  );
}
