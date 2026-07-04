import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Hexagon } from './Hexagon';

const CLIP_POLYGON = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';

afterEach(cleanup);

describe('Hexagon', () => {
  it('should render three nested clip-path layers when showDot is default', () => {
    const { container } = render(<Hexagon size={74} />);

    const layers = container.querySelectorAll('div');
    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      expect(layer.getAttribute('style')).toContain(CLIP_POLYGON);
    }
  });

  it('should omit the center dot when showDot is false', () => {
    const { container } = render(<Hexagon size={30} showDot={false} />);

    expect(container.querySelectorAll('div')).toHaveLength(2);
  });

  it('should omit the dot when children are provided even if showDot is true', () => {
    const { container } = render(<Hexagon size={32}><span data-testid="child" /></Hexagon>);

    // No dot div — children replaces it in the middle layer.
    expect(container.querySelectorAll('div')).toHaveLength(2);
    expect(container.querySelector('[data-testid="child"]')).toBeTruthy();
  });

  it('should render with innerBg="bg-deep"', () => {
    const { container } = render(<Hexagon size={32} innerBg="bg-deep" showDot={false} />);

    const middle = container.querySelectorAll('div')[1];
    expect(middle.getAttribute('style')).toContain('var(--bg-deep)');
  });

  it('should forward className and style to the outer element', () => {
    const { container } = render(
      <Hexagon size={74} className="custom-class" style={{ opacity: 0.5 }} />,
    );

    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toBe('custom-class');
    expect(outer.style.opacity).toBe('0.5');
  });

  it('should clamp invalid size values without crashing', () => {
    const { container } = render(<Hexagon size={0} />);
    expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(2);
  });

  it('should calculate fallback dimensions for non-exact sizes', () => {
    const { container } = render(<Hexagon size={100} />);
    expect(container.querySelectorAll('div')).toHaveLength(3);
  });
});
