// Authenticated app shell (Story 2.2, AC2 + AC5). Outer flex row: Sidebar +
// a content column (Header on top, scrollable content below). The content area
// renders a minimal titled placeholder per active screen — the real Search and
// Documents views are Epic 4 (Historia 4.3/4.4), NOT built here.
import type { CSSProperties, ReactElement } from 'react';

import { Header } from './Header';
import { Sidebar, type Screen } from './Sidebar';
import type { Theme } from '../hooks/useTheme';

interface AppLayoutProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  communityName: string;
  statsLine: string;
  user: { name: string; initials: string };
  theme: Theme;
  onToggleTheme: () => void;
  onLogout: () => void;
}

const shellStyle: CSSProperties = {
  display: 'flex',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
};

const contentColumnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
};

const contentAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '0 24px',
};

// Minimal placeholders — the real views arrive in Epic 4.
const PLACEHOLDERS: Record<Screen, { title: string; description: string }> = {
  search: {
    title: 'Búsqueda de conocimiento',
    description: 'La búsqueda semántica llega en el Épico 4.',
  },
  docs: {
    title: 'Documentos indexados',
    description: 'La vista de documentos y el read-tracking llegan en el Épico 4.',
  },
};

export function AppLayout({
  activeScreen,
  onNavigate,
  communityName,
  statsLine,
  user,
  theme,
  onToggleTheme,
  onLogout,
}: AppLayoutProps): ReactElement {
  const placeholder = PLACEHOLDERS[activeScreen];

  return (
    <div style={shellStyle}>
      <Sidebar activeScreen={activeScreen} onNavigate={onNavigate} />

      <div style={contentColumnStyle}>
        <Header
          communityName={communityName}
          statsLine={statsLine}
          user={user}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
        />

        <main style={contentAreaStyle}>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 24,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {placeholder.title}
          </h2>
          <p style={{ marginTop: 10, fontSize: 14, color: 'var(--text-muted)' }}>
            {placeholder.description}
          </p>
        </main>
      </div>
    </div>
  );
}
