import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import * as authApi from './api/auth';

// Mock the fetch client (Story 2.4): tests drive the real session flow through
// fetchMe/logout without touching the network. LOGIN_URL keeps its real value.
vi.mock('./api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/auth')>();
  return { ...actual, fetchMe: vi.fn(), logout: vi.fn() };
});

const fetchMe = vi.mocked(authApi.fetchMe);
const logout = vi.mocked(authApi.logout);

const PROFILE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  discordId: '123456789012345678',
  username: 'ada lovelace',
  avatar: null,
  guildId: '111222333444555666',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('App session flow', () => {
  it('should show the login screen when the session check returns 401 (anon)', async () => {
    fetchMe.mockResolvedValue(null);

    render(<App />);

    // The login screen appears once /me resolves; the authed shell (a <header>
    // banner) is NOT rendered.
    expect(await screen.findByRole('button', { name: /Continuar con Discord/i })).toBeTruthy();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('should render the authenticated shell with the real username, initials and community name', async () => {
    fetchMe.mockResolvedValue(PROFILE);

    render(<App />);

    // The real username derived from the session profile.
    expect(await screen.findByText('ada lovelace')).toBeTruthy();
    // Initials derived from the username ("ada lovelace" → "AL").
    expect(screen.getByText('AL')).toBeTruthy();
    // Community name (build default) renders in the header banner (unambiguous:
    // "Hivly" also appears as the sidebar wordmark).
    expect(within(screen.getByRole('banner')).getByText('Hivly')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continuar con Discord/i })).toBeNull();
  });

  it('should navigate to the login URL when the Discord button is clicked', async () => {
    fetchMe.mockResolvedValue(null);
    const original = window.location;
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Continuar con Discord/i }));

    expect(window.location.href).toBe(authApi.LOGIN_URL);
    Object.defineProperty(window, 'location', { value: original, writable: true });
  });

  it('should return to the login screen after logout', async () => {
    fetchMe.mockResolvedValue(PROFILE);
    logout.mockResolvedValue();

    render(<App />);
    await screen.findByText('ada lovelace');

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/i }));

    expect(await screen.findByRole('button', { name: /Continuar con Discord/i })).toBeTruthy();
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('should switch the active content pane when a nav item is clicked (authed)', async () => {
    fetchMe.mockResolvedValue(PROFILE);

    render(<App />);
    // Default pane is Búsqueda once authenticated.
    expect(await screen.findByText('Búsqueda de conocimiento')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Documentos/i }));

    expect(screen.getByText('Documentos indexados')).toBeTruthy();
    expect(screen.queryByText('Búsqueda de conocimiento')).toBeNull();
  });
});
