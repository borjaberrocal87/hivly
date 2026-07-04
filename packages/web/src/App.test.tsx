import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, MOCK_LOGIN_DELAY_MS } from './App';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('App', () => {
  it('should render the login screen when unauthenticated', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /Continuar con Discord/i })).toBeTruthy();
    // The authenticated shell (community name) is not shown yet.
    expect(screen.queryByText('Aurora Labs')).toBeNull();
  });

  it('should not crash when unmounted during the login timer (timer cleanup)', () => {
    vi.useFakeTimers();
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Continuar con Discord/i }));
    // Unmount while the 1100ms timer is still pending.
    expect(() => unmount()).not.toThrow();
  });

  it('should show the loading state then the app shell when Discord login is clicked', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Continuar con Discord/i }));

    // Loading state is visible during the mock delay.
    expect(screen.getByText(/Conectando con Discord/i)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(MOCK_LOGIN_DELAY_MS);
    });

    // Authenticated shell is now rendered.
    expect(screen.getByText('Aurora Labs')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Continuar con Discord/i })).toBeNull();
  });

  it('should return to the login screen when logout is clicked', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Continuar con Discord/i }));
    act(() => {
      vi.advanceTimersByTime(MOCK_LOGIN_DELAY_MS);
    });

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/i }));

    expect(screen.getByRole('button', { name: /Continuar con Discord/i })).toBeTruthy();
    expect(screen.queryByText('Aurora Labs')).toBeNull();
  });

  it('should switch the active content pane when a nav item is clicked', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Continuar con Discord/i }));
    act(() => {
      vi.advanceTimersByTime(MOCK_LOGIN_DELAY_MS);
    });

    // Default pane is Búsqueda.
    expect(screen.getByText('Búsqueda de conocimiento')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Documentos/i }));

    expect(screen.getByText('Documentos indexados')).toBeTruthy();
    expect(screen.queryByText('Búsqueda de conocimiento')).toBeNull();
  });

  it('should reset the active pane to Búsqueda after logging out and back in', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Continuar con Discord/i }));
    act(() => {
      vi.advanceTimersByTime(MOCK_LOGIN_DELAY_MS);
    });
    fireEvent.click(screen.getByRole('button', { name: /Documentos/i }));
    expect(screen.getByText('Documentos indexados')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar con Discord/i }));
    act(() => {
      vi.advanceTimersByTime(MOCK_LOGIN_DELAY_MS);
    });

    expect(screen.getByText('Búsqueda de conocimiento')).toBeTruthy();
  });
});
