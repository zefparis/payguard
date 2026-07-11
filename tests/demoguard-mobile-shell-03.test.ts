/**
 * DEMOGUARD-MOBILE-SHELL-03: Stable mobile app shell — no layout shift during tests
 *
 * Tests:
 *  1. Shell uses stable mobile frame max-width 430
 *  2. DemoGuard does not switch to desktop layout during cognitive phases
 *  3. Cognitive phase changes do not change shell wrapper class
 *  4. Stroop uses 2x2 grid inside 100% width
 *  5. Stroop card has no fixed width > frame
 *  6. Layout metrics detect no width shift (pure function)
 *  7. Simulated visualViewport resize during Stroop does not change frame width (pure function)
 *  8. Signals panel does not mount during cognitive phases
 *  9. Sticky bar does not mount during cognitive phases
 * 10. Compact status row remains single-line
 * 11. Trail Tap area uses card width, not window width
 * 12. Trail Tap points remain clamped after resize
 * 13. No horizontal overflow classes/patterns
 * 14. Build OK (verified separately)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

import {
  computeStableFrameWidth,
  isCognitivePhase,
  shouldIgnoreViewportResizeDuringCognitive,
  COGNITIVE_PHASES,
  MAX_FRAME_WIDTH,
} from '../src/hooks/useStableMobileViewport';
import {
  computeTrailTapLayout,
  computeNodeRadius,
  generateNormalizedTrailPoints,
} from '../src/demoguard/cognitive/trailTapChallenge';

const CSS_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'demoguard-premium.css');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
const INDEX_CSS_FILE = path.resolve(__dirname, '..', 'src', 'index.css');

const CSS_SRC = fs.readFileSync(CSS_FILE, 'utf-8');
const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');
const INDEX_CSS_SRC = fs.readFileSync(INDEX_CSS_FILE, 'utf-8');

// ─── Pure function tests ────────────────────────────────────────────

describe('DEMOGUARD-MOBILE-SHELL-03: Pure functions', () => {
  it('6. computeStableFrameWidth returns min(width, 430)', () => {
    expect(computeStableFrameWidth(360, 360)).toBe(360);
    expect(computeStableFrameWidth(375, 375)).toBe(375);
    expect(computeStableFrameWidth(500, 500)).toBe(430);
    expect(computeStableFrameWidth(430, 430)).toBe(430);
  });

  it('6b. computeStableFrameWidth uses visualViewportWidth when available', () => {
    expect(computeStableFrameWidth(400, 380)).toBe(380);
  });

  it('6c. computeStableFrameWidth falls back to innerWidth', () => {
    expect(computeStableFrameWidth(390, undefined)).toBe(390);
  });

  it('7. shouldIgnoreViewportResizeDuringCognitive returns true for small changes during cognitive', () => {
    expect(shouldIgnoreViewportResizeDuringCognitive(380, 390, 'cognitive-stroop')).toBe(true);
    expect(shouldIgnoreViewportResizeDuringCognitive(380, 420, 'cognitive-stroop')).toBe(true);
  });

  it('7b. shouldIgnoreViewportResizeDuringCognitive returns false for large changes during cognitive', () => {
    expect(shouldIgnoreViewportResizeDuringCognitive(360, 500, 'cognitive-stroop')).toBe(false);
  });

  it('7c. shouldIgnoreViewportResizeDuringCognitive returns false outside cognitive phases', () => {
    expect(shouldIgnoreViewportResizeDuringCognitive(380, 381, 'readiness')).toBe(false);
    expect(shouldIgnoreViewportResizeDuringCognitive(380, 381, 'idle')).toBe(false);
  });

  it('7d. isCognitivePhase correctly identifies cognitive phases', () => {
    expect(isCognitivePhase('cognitive-intro')).toBe(true);
    expect(isCognitivePhase('cognitive-stroop')).toBe(true);
    expect(isCognitivePhase('cognitive-digit-span')).toBe(true);
    expect(isCognitivePhase('cognitive-nback')).toBe(true);
    expect(isCognitivePhase('cognitive-trail-tap')).toBe(true);
    expect(isCognitivePhase('readiness')).toBe(false);
    expect(isCognitivePhase('idle')).toBe(false);
    expect(isCognitivePhase('voice-proof')).toBe(false);
  });

  it('7e. COGNITIVE_PHASES has exactly 5 phases', () => {
    expect(COGNITIVE_PHASES.size).toBe(5);
  });

  it('7f. MAX_FRAME_WIDTH is 430', () => {
    expect(MAX_FRAME_WIDTH).toBe(430);
  });

  it('12. Trail Tap points remain clamped after resize', () => {
    const points = generateNormalizedTrailPoints(5);
    const nodes1 = computeTrailTapLayout(300, 340, points, 24);
    const nodes2 = computeTrailTapLayout(360, 380, points, 24);
    const padding = 24 + 8;
    for (const node of nodes2) {
      expect(node.x).toBeGreaterThanOrEqual(padding);
      expect(node.x).toBeLessThanOrEqual(360 - padding);
      expect(node.y).toBeGreaterThanOrEqual(padding);
      expect(node.y).toBeLessThanOrEqual(380 - padding);
    }
    expect(nodes1.length).toBe(nodes2.length);
  });
});

// ─── CSS structural tests ───────────────────────────────────────────

describe('DEMOGUARD-MOBILE-SHELL-03: CSS structure', () => {
  it('1. Shell uses stable mobile frame max-width 430', () => {
    expect(CSS_SRC).toMatch(/\.dg-app-shell\s*\{[^}]*width:\s*100%/);
    expect(CSS_SRC).toMatch(/\.dg-mobile-frame\s*\{[^}]*max-width:\s*430px/);
  });

  it('1b. dg-mobile-frame uses CSS variable for stable width', () => {
    expect(CSS_SRC).toMatch(/\.dg-mobile-frame\s*\{[^}]*var\(--dg-stable-frame-width/);
  });

  it('2. DemoGuard does not switch to desktop layout during cognitive phases — no padding change in media query', () => {
    const mediaQuery = CSS_SRC.slice(CSS_SRC.indexOf('@media (min-width: 480px)'));
    expect(mediaQuery).not.toMatch(/\.dg-mobile-frame\s*\{[^}]*padding/);
    expect(mediaQuery).not.toMatch(/\.dg-stroop-word/);
  });

  it('4. Stroop uses 2x2 grid with minmax(0, 1fr) inside 100% width', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)/);
    expect(CSS_SRC).toMatch(/\.dg-stroop-grid\s*\{[^}]*width:\s*100%/);
  });

  it('4b. Stroop grid does NOT have max-width constraint', () => {
    expect(CSS_SRC).not.toMatch(/\.dg-stroop-grid\s*\{[^}]*max-width:\s*320px/);
  });

  it('5. Stroop word uses clamp font-size', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-word\s*\{[^}]*font-size:\s*clamp\(34px/);
  });

  it('5b. Stroop word has overflow-wrap: anywhere', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-word\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });

  it('10. Compact status row has fixed height and no wrapping', () => {
    expect(CSS_SRC).toMatch(/\.dg-compact-status-row\s*\{[^}]*height:\s*36px/);
    expect(CSS_SRC).toMatch(/\.dg-compact-status-row\s*\{[^}]*white-space:\s*nowrap/);
    expect(CSS_SRC).toMatch(/\.dg-compact-status-row\s*\{[^}]*overflow:\s*hidden/);
  });

  it('10b. Compact status row has flex-shrink: 0', () => {
    expect(CSS_SRC).toMatch(/\.dg-compact-status-row\s*\{[^}]*flex-shrink:\s*0/);
  });

  it('11. Trail Tap area uses width 100%, not max-width', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*width:\s*100%/);
    expect(CSS_SRC).not.toMatch(/\.dg-trail-area\s*\{[^}]*max-width:\s*320px/);
  });

  it('11b. Trail Tap area has min-height and max-height', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*min-height:\s*300px/);
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*max-height:\s*420px/);
  });

  it('11c. Trail Tap area has box-sizing: border-box', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*box-sizing:\s*border-box/);
  });

  it('13. dg-test-card has stable dimensions', () => {
    expect(CSS_SRC).toMatch(/\.dg-test-card\s*\{[^}]*width:\s*100%/);
    expect(CSS_SRC).toMatch(/\.dg-test-card\s*\{[^}]*min-width:\s*0/);
    expect(CSS_SRC).toMatch(/\.dg-test-card\s*\{[^}]*overflow:\s*hidden/);
    expect(CSS_SRC).toMatch(/\.dg-test-card\s*\{[^}]*min-height:\s*clamp/);
  });

  it('13b. No .dg-page class remains in CSS', () => {
    expect(CSS_SRC).not.toMatch(/\.dg-page\s*\{/);
  });

  it('13c. Global box-sizing border-box in index.css', () => {
    expect(INDEX_CSS_SRC).toMatch(/\*\s*\{[^}]*box-sizing:\s*border-box/);
  });

  it('13d. Media elements have max-width: 100% in index.css', () => {
    expect(INDEX_CSS_SRC).toMatch(/img,\s*video,\s*canvas,\s*svg\s*\{[^}]*max-width:\s*100%/);
  });
});

// ─── JSX structural tests ───────────────────────────────────────────

describe('DEMOGUARD-MOBILE-SHELL-03: JSX structure', () => {
  it('1. JSX uses dg-app-shell root', () => {
    expect(PAGE_SRC).toContain('dg-app-shell');
  });

  it('1b. JSX uses dg-mobile-frame', () => {
    expect(PAGE_SRC).toContain('dg-mobile-frame');
    expect(PAGE_SRC).toContain('data-testid="dg-mobile-frame"');
  });

  it('1c. JSX sets --dg-stable-frame-width CSS variable', () => {
    expect(PAGE_SRC).toContain('--dg-stable-frame-width');
  });

  it('2. JSX does not switch wrapper class based on phase', () => {
    expect(PAGE_SRC).not.toMatch(/className=.*phase.*dg-app-shell/);
  });

  it('3. Cognitive phases use single dg-test-card wrapper', () => {
    expect(PAGE_SRC).toContain('dg-test-card');
    expect(PAGE_SRC).toContain('data-testid="dg-test-card"');
    expect(PAGE_SRC).toContain('isCognitivePhase(phase)');
  });

  it('3b. No dg-card dg-challenge-area for cognitive phases (replaced by dg-test-card)', () => {
    const cognitiveSection = PAGE_SRC.slice(
      PAGE_SRC.indexOf('Cognitive Battery'),
      PAGE_SRC.indexOf('Voice proof'),
    );
    expect(cognitiveSection).not.toContain('dg-card dg-challenge-area');
  });

  it('8. Signals panel does not mount during cognitive phases', () => {
    const signalCondition = PAGE_SRC.slice(
      PAGE_SRC.indexOf('Signal Matrix'),
      PAGE_SRC.indexOf('Signaux</h3>'),
    );
    expect(signalCondition).toContain("phase !== 'cognitive-stroop'");
    expect(signalCondition).toContain("phase !== 'cognitive-digit-span'");
    expect(signalCondition).toContain("phase !== 'cognitive-nback'");
    expect(signalCondition).toContain("phase !== 'cognitive-trail-tap'");
    expect(signalCondition).toContain("phase !== 'cognitive-intro'");
  });

  it('9. Sticky bar does not mount during cognitive phases', () => {
    expect(PAGE_SRC).not.toContain("'dg-sticky-mini'");
    expect(PAGE_SRC).toContain("phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error'");
  });

  it('9b. Sticky bar has no dg-sticky-mini class', () => {
    expect(PAGE_SRC).not.toMatch(/dg-sticky-mini/);
    expect(CSS_SRC).not.toMatch(/dg-sticky-mini/);
  });

  it('10. Compact status row is rendered during cognitive phases', () => {
    expect(PAGE_SRC).toContain('dg-compact-status-row');
    expect(PAGE_SRC).toContain('data-testid="dg-compact-status-row"');
  });

  it('10b. Compact status row uses isCognitivePhase', () => {
    const statusSection = PAGE_SRC.slice(
      PAGE_SRC.indexOf('Compact status row'),
      PAGE_SRC.indexOf('Cognitive Battery'),
    );
    expect(statusSection).toContain('isCognitivePhase(phase)');
    expect(statusSection).toContain('dg-compact-status-row');
  });

  it('13. No horizontal overflow patterns — no width: fit-content, max-content, min-content', () => {
    expect(CSS_SRC).not.toMatch(/width:\s*fit-content/);
    expect(CSS_SRC).not.toMatch(/width:\s*max-content/);
    expect(CSS_SRC).not.toMatch(/width:\s*min-content/);
  });

  it('13b. No negative margins in cognitive-related CSS', () => {
    expect(CSS_SRC).not.toMatch(/\.dg-test-card\s*\{[^}]*margin-left:\s*-/);
    expect(CSS_SRC).not.toMatch(/\.dg-stroop-grid\s*\{[^}]*margin-left:\s*-/);
  });

  it('13c. useStableMobileViewport hook is imported', () => {
    expect(PAGE_SRC).toContain('useStableMobileViewport');
  });

  it('13d. isCognitivePhase is imported and used', () => {
    expect(PAGE_SRC).toContain('isCognitivePhase');
  });

  it('13e. No .dg-page class in JSX', () => {
    expect(PAGE_SRC).not.toContain('className="dg-page"');
  });
});
