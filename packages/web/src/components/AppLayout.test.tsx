// Focused responsive-shell test (Story 11.2, AC2/AC3/AC4). Drives isMobile both
// ways — the prop is drilled, so no matchMedia stub is needed. The three content
// views are mocked to null (their data-fetching effects are irrelevant here; the
// subject is the Sidebar↔BottomNav switch and the Header collapse). No jest-dom
// matchers (toBeTruthy()/toBeNull()), per project testing rules.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { UnreadCountResponse } from '@share2brain/shared/schemas';

import { AppLayout } from './AppLayout';

// Mock the content views so AppLayout can render without their API effects.
vi.mock('./SearchView', () => ({ SearchView: () => null }));
vi.mock('./DocsView', () => ({ DocsView: () => null }));
vi.mock('./StatsView', () => ({ StatsView: () => null }));

const STATS_LINE = 'STATS-LINE-MARKER';

function renderShell(overrides: { isMobile: boolean; unreadCount?: number }) {
  const unreadCounts: UnreadCountResponse = {};
  return render(
    <AppLayout
      activeScreen="docs"
      onNavigate={() => {}}
      communityName="Test Community"
      statsLine={STATS_LINE}
      user={{ name: 'ada lovelace', initials: 'AL' }}
      theme="dark"
      onToggleTheme={() => {}}
      onLogout={() => {}}
      isGuest={false}
      isMobile={overrides.isMobile}
      guildId="111222333444555666"
      unreadCount={overrides.unreadCount ?? 0}
      unreadCounts={unreadCounts}
      onUnreadChange={() => {}}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe('AppLayout responsive shell', () => {
  it('should render the desktop Sidebar and full Header when isMobile is false', () => {
    renderShell({ isMobile: false, unreadCount: 5 });

    // Sidebar-only markers present; bottom-nav absent.
    expect(screen.getByText('self-hosted · open source')).toBeTruthy();
    expect(screen.getByTestId('sidebar-badge')).toBeTruthy();
    expect(screen.queryByTestId('bottom-nav-badge')).toBeNull();

    // Full header: statsLine, live pill and username all present; no mobile hexagon.
    expect(screen.getByText(STATS_LINE)).toBeTruthy();
    expect(screen.getByTestId('live-pulse')).toBeTruthy();
    expect(screen.getByText('ada lovelace')).toBeTruthy();
    const banner = screen.getByRole('banner');
    expect(banner.querySelector('[style*="polygon"]')).toBeNull();

    // Exactly one Documentos nav button (AC2 — never both navs).
    expect(screen.getAllByRole('button', { name: /Documentos/i })).toHaveLength(1);
  });

  it('should render the mobile BottomNav and collapsed Header when isMobile is true', () => {
    renderShell({ isMobile: true, unreadCount: 5 });

    // Sidebar absent; bottom-nav badge present.
    expect(screen.queryByText('self-hosted · open source')).toBeNull();
    expect(screen.queryByTestId('sidebar-badge')).toBeNull();
    expect(screen.getByTestId('bottom-nav-badge')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-badge').textContent).toBe('5');

    // Collapsed header: statsLine, live pill and username all gone; mobile hexagon present.
    expect(screen.queryByText(STATS_LINE)).toBeNull();
    expect(screen.queryByTestId('live-pulse')).toBeNull();
    expect(screen.queryByText('ada lovelace')).toBeNull();
    const banner = screen.getByRole('banner');
    expect(banner.querySelector('[style*="polygon"]')).toBeTruthy();

    // Community name still present on both viewports; still exactly one Documentos button.
    expect(within(banner).getByText('Test Community')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Documentos/i })).toHaveLength(1);
  });

  it('should not render the bottom-nav badge when unreadCount is 0', () => {
    renderShell({ isMobile: true, unreadCount: 0 });

    expect(screen.queryByTestId('bottom-nav-badge')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Documentos/i })).toHaveLength(1);
  });
});
