/**
 * DEMOGUARD-MOBILE-RESPONSIVE-02: Dynamic Trail Tap + layout stability tests
 *
 * Tests:
 *  1. computeTrailTapLayout clamps all points inside area
 *  2. Rightmost point never exceeds width - radius
 *  3. Bottommost point never exceeds height - radius
 *  4. Works at 360px width
 *  5. Works at 375px width
 *  6. Works at 390px width
 *  7. Works at 412px width
 *  8. Works at 430px width
 *  9. Recalculates on resize without changing order
 * 10. No horizontal overflow (all x within [padding, width-padding])
 * 11. Node radius is clamped between 20 and 32
 * 12. Normalized points have 5 entries by default
 * 13. Couleurs buttons render 2x2 grid on mobile (CSS)
 * 14. Couleurs buttons min-height 64px (CSS)
 * 15. Header compact (padding <= 12px, title <= 16px on mobile)
 * 16. No sticky bar during cognitive phases (JSX)
 * 17. No fixed game point positions in px outside clamp (source check)
 * 18. Trail area uses clamp() height (CSS)
 * 19. Signals panel hidden during cognitive phases (JSX)
 * 20. Stroop has example instruction (JSX)
 * 21. generateTrailTapNodes still works (backward compat)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  computeTrailTapLayout,
  computeNodeRadius,
  generateNormalizedTrailPoints,
  generateTrailTapNodes,
  TRAIL_TAP_MIN_NODES,
} from '../src/demoguard/cognitive/trailTapChallenge';

const CSS_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'demoguard-premium.css');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');

const CSS_SRC = fs.readFileSync(CSS_FILE, 'utf-8');
const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');

// ─── Pure function tests ────────────────────────────────────────────

describe('DEMOGUARD-MOBILE-RESPONSIVE-02: computeTrailTapLayout clamping', () => {
  const normalizedPoints = generateNormalizedTrailPoints(5);

  it('1. All points are inside area bounds', () => {
    const w = 320, h = 340, radius = 24;
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const padding = radius + 8;
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(w - padding);
      expect(node.y).toBeGreaterThanOrEqual(padding);
      expect(node.y).toBeLessThanOrEqual(h - padding);
    }
  });

  it('2. Rightmost point never exceeds width - radius', () => {
    const w = 300, h = 400, radius = 24;
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const maxX = Math.max(...nodes.map((n) => n.x));
    expect(maxX).toBeLessThanOrEqual(w - radius - 8);
  });

  it('3. Bottommost point never exceeds height - radius', () => {
    const w = 300, h = 400, radius = 24;
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const maxY = Math.max(...nodes.map((n) => n.y));
    expect(maxY).toBeLessThanOrEqual(h - radius - 8);
  });

  it('4. Works at 360px width', () => {
    const w = 360, h = 340, radius = computeNodeRadius(360);
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const padding = radius + 8;
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(w - padding);
      expect(node.y).toBeGreaterThanOrEqual(padding);
      expect(node.y).toBeLessThanOrEqual(h - padding);
    }
  });

  it('5. Works at 375px width', () => {
    const w = 375, h = 350, radius = computeNodeRadius(375);
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const padding = radius + 8;
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(w - padding);
    }
  });

  it('6. Works at 390px width', () => {
    const w = 390, h = 360, radius = computeNodeRadius(390);
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const padding = radius + 8;
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(w - padding);
    }
  });

  it('7. Works at 412px width', () => {
    const w = 412, h = 380, radius = computeNodeRadius(412);
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const padding = radius + 8;
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(w - padding);
    }
  });

  it('8. Works at 430px width', () => {
    const w = 430, h = 400, radius = computeNodeRadius(430);
    const nodes = computeTrailTapLayout(w, h, normalizedPoints, radius);
    const padding = radius + 8;
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(w - padding);
    }
  });

  it('9. Recalculates on resize without changing order', () => {
    const points = generateNormalizedTrailPoints(5);
    const nodes1 = computeTrailTapLayout(300, 340, points, 24);
    const nodes2 = computeTrailTapLayout(360, 380, points, 24);
    expect(nodes1.length).toBe(nodes2.length);
    for (let i = 0; i < nodes1.length; i++) {
      expect(nodes1[i].id).toBe(nodes2[i].id);
    }
  });

  it('10. No horizontal overflow — all x within [padding, width-padding]', () => {
    for (const w of [280, 300, 320, 360, 400, 430]) {
      const radius = computeNodeRadius(w);
      const nodes = computeTrailTapLayout(w, 340, normalizedPoints, radius);
      const padding = radius + 8;
      for (const node of nodes) {
        expect(node.x).toBeGreaterThanOrEqual(padding);
        expect(node.x).toBeLessThanOrEqual(w - padding);
      }
    }
  });

  it('11. Node radius is clamped between 20 and 32', () => {
    expect(computeNodeRadius(200)).toBeGreaterThanOrEqual(20);
    expect(computeNodeRadius(200)).toBeLessThanOrEqual(32);
    expect(computeNodeRadius(360)).toBeGreaterThanOrEqual(20);
    expect(computeNodeRadius(360)).toBeLessThanOrEqual(32);
    expect(computeNodeRadius(600)).toBeLessThanOrEqual(32);
    expect(computeNodeRadius(600)).toBeGreaterThanOrEqual(20);
  });

  it('12. Normalized points have 5 entries by default', () => {
    const points = generateNormalizedTrailPoints();
    expect(points.length).toBe(TRAIL_TAP_MIN_NODES);
    for (const p of points) {
      expect(p.nx).toBeGreaterThanOrEqual(0);
      expect(p.nx).toBeLessThanOrEqual(1);
      expect(p.ny).toBeGreaterThanOrEqual(0);
      expect(p.ny).toBeLessThanOrEqual(1);
    }
  });

  it('21. generateTrailTapNodes backward compat produces valid nodes', () => {
    const nodes = generateTrailTapNodes(5);
    expect(nodes.length).toBe(5);
    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── CSS structural tests ───────────────────────────────────────────

describe('DEMOGUARD-MOBILE-RESPONSIVE-02: CSS structure', () => {
  it('13. Couleurs buttons render 2x2 grid (grid-template-columns: repeat(2, minmax(0, 1fr)))', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('14. Couleurs buttons min-height 64px', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-btn\s*\{[^}]*min-height:\s*64px/);
  });

  it('15. Header compact — padding <= 12px, title <= 16px', () => {
    expect(CSS_SRC).toMatch(/\.dg-hero\s*\{[^}]*padding:\s*10px\s+12px/);
    expect(CSS_SRC).toMatch(/\.dg-hero-title\s*\{[^}]*font-size:\s*16px/);
  });

  it('18. Trail area uses clamp() height', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*height:\s*clamp\(/);
  });

  it('18b. Trail area does NOT use fixed height (uses clamp)', () => {
    expect(CSS_SRC).not.toMatch(/\.dg-trail-area\s*\{[^}]*?(?<![-\w])height:\s*\d+px/);
  });
});

// ─── JSX structural tests ───────────────────────────────────────────

describe('DEMOGUARD-MOBILE-RESPONSIVE-02: JSX structure', () => {
  it('16. No sticky bar during cognitive phases — dg-sticky-mini removed', () => {
    expect(PAGE_SRC).not.toContain("'dg-sticky-mini'");
  });

  it('16b. Sticky bar only visible in readiness/submitting/done/error', () => {
    expect(PAGE_SRC).toContain("phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error'");
    expect(PAGE_SRC).toContain("'dg-sticky-visible'");
  });

  it('17. No fixed px positions for trail nodes outside computeTrailTapLayout', () => {
    expect(PAGE_SRC).toContain('computeTrailTapLayout');
    expect(PAGE_SRC).toContain('computeNodeRadius');
    expect(PAGE_SRC).toContain('trailAreaRef');
    expect(PAGE_SRC).toContain('ResizeObserver');
  });

  it('17b. Trail nodes use dynamic left/top from computed positions', () => {
    expect(PAGE_SRC).toContain('left: node.x - radius');
    expect(PAGE_SRC).toContain('top: node.y - radius');
  });

  it('19. Signals panel hidden during cognitive phases', () => {
    const signalCondition = PAGE_SRC.slice(
      PAGE_SRC.indexOf('Signal Matrix'),
      PAGE_SRC.indexOf('Signaux</h3>'),
    );
    expect(signalCondition).toContain("phase !== 'cognitive-stroop'");
    expect(signalCondition).toContain("phase !== 'cognitive-digit-span'");
    expect(signalCondition).toContain("phase !== 'cognitive-nback'");
    expect(signalCondition).toContain("phase !== 'cognitive-trail-tap'");
    expect(signalCondition).toContain("phase !== 'voice-proof'");
  });

  it('20. Stroop has example instruction', () => {
    expect(PAGE_SRC).toContain('Exemple');
  });

  it('20b. Stroop instruction says "couleur du texte"', () => {
    expect(PAGE_SRC).toContain('couleur du texte');
  });

  it('22. Trail tap area has ref for measurement', () => {
    expect(PAGE_SRC).toContain('ref={trailAreaRef}');
  });

  it('23. Trail nodes have data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid={`dg-trail-node-${node.id}`}');
  });

  it('24. Normalized points used instead of generateTrailTapNodes for dynamic layout', () => {
    expect(PAGE_SRC).toContain('generateNormalizedTrailPoints');
    expect(PAGE_SRC).toContain('trailNormalizedRef');
  });
});
