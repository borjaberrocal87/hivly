// @hivly/web — static React SPA (AD-3: Vite build, no SSR, no Node server).
// Story 2.1 lays the design-system foundation (tokens, fonts, keyframes, the
// Hexagon primitive). The full app shell — login, sidebar, header, router, and
// the persistent theme toggle + localStorage — arrives in Story 2.2.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Hexagon } from './components/Hexagon';
import './styles/global.css';

// Default theme is dark; the persistent toggle lands in Story 2.2.
document.documentElement.setAttribute('data-kh', 'dark');

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Hexagon size={74} />
    </StrictMode>,
  );
} else {
  const msg = document.createTextNode('Fatal: #root element not found — cannot mount React app.');
  document.body.prepend(msg);
  console.error('Fatal: #root element not found — cannot mount React app.');
}
