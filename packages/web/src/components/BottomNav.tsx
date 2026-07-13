// Mobile bottom navigation (Story 11.2, AC3). The mobile-only counterpart of the
// desktop Sidebar's nav row: a fixed bar with the SAME three items (reusing
// Sidebar's NAV_ITEMS for accessible-name parity) and the Documentos unread
// badge. Rendered instead of the Sidebar below 760px (AppLayout switches on
// isMobile — conditional render, never both). Styles are pasted verbatim from
// the design (Share2Brain Web.dc.html L444, L828-831, L448-450); tokens already
// match post-11.1. Item colors are state-driven (active/inactive), not :hover —
// no touch hover — so inline color is correct here; a :focus-visible outline
// lives in components.css (.kh-bottom-nav-item) per the app-wide a11y convention.
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { NAV_ITEMS, type Screen } from './Sidebar';

interface BottomNavProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  /** Documentos badge count; 0 (default) renders no badge — same path as the sidebar badge. */
  unreadCount?: number;
}

const navStyle: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 55,
  display: 'flex',
  alignItems: 'stretch',
  height: 62,
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background: 'var(--bg-deep)',
  borderTop: '1px solid var(--line)',
};

const itemBaseStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  flex: 1,
  padding: '8px 4px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 10.5,
  fontWeight: 500,
  transition: 'color .12s ease',
};

const iconWrapStyle: CSSProperties = { position: 'relative', display: 'flex' };

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: -5,
  right: -9,
  minWidth: 15,
  height: 15,
  padding: '0 4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 9,
  fontWeight: 600,
  color: 'var(--on-accent)',
  background: '#F5A623',
  borderRadius: 8,
};

export function BottomNav({
  activeScreen,
  onNavigate,
  unreadCount = 0,
}: BottomNavProps): ReactElement {
  const { t } = useTranslation();
  return (
    <nav style={navStyle}>
      {NAV_ITEMS.map(({ screen, labelKey, icon }) => {
        const active = screen === activeScreen;
        return (
          <button
            key={screen}
            type="button"
            className="kh-bottom-nav-item"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(screen)}
            style={{ ...itemBaseStyle, color: active ? 'var(--accent-ink)' : 'var(--tx4)' }}
          >
            <span style={iconWrapStyle}>
              {icon}
              {screen === 'docs' && unreadCount > 0 && (
                <span data-testid="bottom-nav-badge" style={badgeStyle}>
                  {unreadCount}
                </span>
              )}
            </span>
            <span>{t(labelKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}
