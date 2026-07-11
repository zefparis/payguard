/**
 * DEMOGUARD-MOBILE-RESPONSIVE-01: Mobile-first responsive tests
 *
 * Verifies:
 * 1. Container uses mobile-first max-width (<= 460px) and 100dvh
 * 2. No horizontal overflow (overflow-x: hidden)
 * 3. Header is compact (padding <= 14px, font-size <= 18px)
 * 4. Stroop buttons use 2x2 grid (dg-stroop-grid, grid-template-columns: repeat(2, 1fr))
 * 5. Stroop buttons have min-height >= 64px
 * 6. N-Back buttons are touch-friendly (min-height >= 64px, flex layout)
 * 7. Digit Span keypad uses responsive grid (dg-digit-keypad, repeat(5, 1fr))
 * 8. Digit keys have min-height >= 48px
 * 9. Trail Tap area is fluid (width: 100%, max-width <= 320px)
 * 10. Trail nodes have size >= 48px
 * 11. Sticky bar is hidden by default (display: none) and only visible in review/submitting/done/error
 * 12. All buttons have min-height >= 48px (dg-btn) or >= 64px (cognitive buttons)
 * 13. Text sizes >= 14px for body text
 * 14. Safe-area-inset-bottom is used
 * 15. No "Passer" button in scored cognitive test phases (Stroop, N-Back, Digit Span, Trail Tap)
 * 16. data-testid attributes present for key UI elements
 * 17. 100dvh used instead of 100vh
 * 18. dg-progress-strip class exists for progress bar
 * 19. dg-stroop-grid class used in JSX for Stroop buttons
 * 20. dg-digit-keypad class used in JSX for digit buttons
 * 21. dg-nback-btns class used in JSX for N-Back buttons
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const CSS_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'demoguard-premium.css');
const PAGE_FILE = path.resolve(__dirname, '..', 'src', 'pages', 'DemoGuard.tsx');
const INDEX_CSS_FILE = path.resolve(__dirname, '..', 'src', 'index.css');

const CSS_SRC = fs.readFileSync(CSS_FILE, 'utf-8');
const PAGE_SRC = fs.readFileSync(PAGE_FILE, 'utf-8');
const INDEX_CSS_SRC = fs.readFileSync(INDEX_CSS_FILE, 'utf-8');

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Container', () => {
  it('1. .dg-page uses max-width <= 460px', () => {
    expect(CSS_SRC).toMatch(/\.dg-page\s*\{[^}]*max-width:\s*460px/);
  });

  it('2. .dg-page uses 100dvh (not 100vh)', () => {
    expect(CSS_SRC).toMatch(/\.dg-page\s*\{[^}]*min-height:\s*100dvh/);
    expect(CSS_SRC).not.toMatch(/\.dg-page\s*\{[^}]*min-height:\s*100vh/);
  });

  it('3. .dg-page has overflow-x: hidden', () => {
    expect(CSS_SRC).toMatch(/\.dg-page\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it('4. .dg-page uses safe-area-inset-bottom', () => {
    expect(CSS_SRC).toMatch(/\.dg-page\s*\{[^}]*env\(safe-area-inset-bottom\)/);
  });

  it('5. .dg-page uses safe-area-inset-top', () => {
    expect(CSS_SRC).toMatch(/\.dg-page\s*\{[^}]*env\(safe-area-inset-top\)/);
  });

  it('6. .app-shell uses 100dvh and max-width <= 460px', () => {
    expect(INDEX_CSS_SRC).toMatch(/\.app-shell\s*\{[^}]*min-height:\s*100dvh/);
    expect(INDEX_CSS_SRC).toMatch(/\.app-shell\s*\{[^}]*max-width:\s*460px/);
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Compact header', () => {
  it('7. .dg-hero padding <= 14px on mobile', () => {
    expect(CSS_SRC).toMatch(/\.dg-hero\s*\{[^}]*padding:\s*12px\s+14px/);
  });

  it('8. .dg-hero-title font-size <= 18px on mobile', () => {
    expect(CSS_SRC).toMatch(/\.dg-hero-title\s*\{[^}]*font-size:\s*18px/);
  });

  it('9. .dg-hero-sub font-size <= 12px', () => {
    expect(CSS_SRC).toMatch(/\.dg-hero-sub\s*\{[^}]*font-size:\s*12px/);
  });

  it('10. .dg-trace-id has max-width and truncation', () => {
    expect(CSS_SRC).toMatch(/\.dg-trace-id\s*\{[^}]*max-width:\s*140px/);
    expect(CSS_SRC).toMatch(/\.dg-trace-id\s*\{[^}]*text-overflow:\s*ellipsis/);
    expect(CSS_SRC).toMatch(/\.dg-trace-id\s*\{[^}]*white-space:\s*nowrap/);
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Stroop 2x2 grid', () => {
  it('11. .dg-stroop-grid uses grid-template-columns: repeat(2, 1fr)', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  });

  it('12. .dg-stroop-grid has gap >= 10px', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-grid\s*\{[^}]*gap:\s*10px/);
  });

  it('13. .dg-stroop-btn has min-height >= 64px', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-btn\s*\{[^}]*min-height:\s*64px/);
  });

  it('14. .dg-stroop-btn has width: 100% (fills grid cell)', () => {
    expect(CSS_SRC).toMatch(/\.dg-stroop-btn\s*\{[^}]*width:\s*100%/);
  });

  it('15. JSX uses dg-stroop-grid class for Stroop buttons', () => {
    expect(PAGE_SRC).toContain('dg-stroop-grid');
    expect(PAGE_SRC).toContain('data-testid="dg-stroop-grid"');
  });

  it('16. Stroop buttons have French labels (Rouge, Bleu, Vert, Jaune)', () => {
    expect(PAGE_SRC).toContain("'Rouge'");
    expect(PAGE_SRC).toContain("'Bleu'");
    expect(PAGE_SRC).toContain("'Vert'");
    expect(PAGE_SRC).toContain("'Jaune'");
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: N-Back touch-friendly', () => {
  it('17. .dg-nback-btns uses flex layout', () => {
    expect(CSS_SRC).toMatch(/\.dg-nback-btns\s*\{[^}]*display:\s*flex/);
  });

  it('18. .dg-nback-btn has min-height >= 64px', () => {
    expect(CSS_SRC).toMatch(/\.dg-nback-btn\s*\{[^}]*min-height:\s*64px/);
  });

  it('19. .dg-nback-btn uses flex: 1 for equal width', () => {
    expect(CSS_SRC).toMatch(/\.dg-nback-btn\s*\{[^}]*flex:\s*1/);
  });

  it('20. JSX uses dg-nback-btns class', () => {
    expect(PAGE_SRC).toContain('dg-nback-btns');
    expect(PAGE_SRC).toContain('data-testid="dg-nback-btns"');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Digit Span keypad', () => {
  it('21. .dg-digit-keypad uses grid repeat(5, 1fr)', () => {
    expect(CSS_SRC).toMatch(/\.dg-digit-keypad\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*1fr\)/);
  });

  it('22. .dg-digit-key has min-height >= 48px', () => {
    expect(CSS_SRC).toMatch(/\.dg-digit-key\s*\{[^}]*min-height:\s*52px/);
  });

  it('23. .dg-digit-keypad has max-width <= 300px', () => {
    expect(CSS_SRC).toMatch(/\.dg-digit-keypad\s*\{[^}]*max-width:\s*300px/);
  });

  it('24. JSX uses dg-digit-keypad class', () => {
    expect(PAGE_SRC).toContain('dg-digit-keypad');
    expect(PAGE_SRC).toContain('data-testid="dg-digit-keypad"');
  });

  it('25. JSX uses dg-digit-key class for digit buttons', () => {
    expect(PAGE_SRC).toContain('dg-digit-key');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Trail Tap area', () => {
  it('26. .dg-trail-area uses width: 100% (fluid)', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*width:\s*100%/);
  });

  it('27. .dg-trail-area has max-width <= 320px', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*max-width:\s*320px/);
  });

  it('28. .dg-trail-area has overflow: hidden', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-area\s*\{[^}]*overflow:\s*hidden/);
  });

  it('29. .dg-trail-node has width and height >= 48px', () => {
    expect(CSS_SRC).toMatch(/\.dg-trail-node\s*\{[^}]*width:\s*48px/);
    expect(CSS_SRC).toMatch(/\.dg-trail-node\s*\{[^}]*height:\s*48px/);
  });

  it('30. JSX has data-testid on trail area', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-trail-area"');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Sticky bar non-blocking', () => {
  it('31. .dg-sticky-bar has display: none by default', () => {
    expect(CSS_SRC).toMatch(/\.dg-sticky-bar\s*\{[^}]*display:\s*none/);
  });

  it('32. .dg-sticky-bar.dg-sticky-visible has display: flex', () => {
    expect(CSS_SRC).toMatch(/\.dg-sticky-bar\.dg-sticky-visible\s*\{[^}]*display:\s*flex/);
  });

  it('33. .dg-sticky-bar.dg-sticky-mini hides actions', () => {
    expect(CSS_SRC).toMatch(/\.dg-sticky-bar\.dg-sticky-mini\s+\.dg-sticky-actions\s*\{[^}]*display:\s*none/);
  });

  it('34. .dg-sticky-bar uses safe-area-inset-bottom', () => {
    expect(CSS_SRC).toMatch(/\.dg-sticky-bar\s*\{[^}]*env\(safe-area-inset-bottom\)/);
  });

  it('35. .dg-sticky-bar max-width <= 460px', () => {
    expect(CSS_SRC).toMatch(/\.dg-sticky-bar\s*\{[^}]*max-width:\s*460px/);
  });

  it('36. JSX applies dg-sticky-visible only in review/submitting/done/error phases', () => {
    expect(PAGE_SRC).toContain("phase === 'readiness' || phase === 'submitting' || phase === 'done' || phase === 'error'");
    expect(PAGE_SRC).toContain("'dg-sticky-visible'");
  });

  it('37. JSX applies dg-sticky-mini during cognitive phases', () => {
    expect(PAGE_SRC).toContain("'dg-sticky-mini'");
  });

  it('38. JSX has data-testid on sticky bar', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-sticky-bar"');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Touch accessibility', () => {
  it('39. .dg-btn has min-height >= 48px', () => {
    expect(CSS_SRC).toMatch(/\.dg-btn\s*\{[^}]*min-height:\s*48px/);
  });

  it('40. .dg-btn font-size >= 14px', () => {
    expect(CSS_SRC).toMatch(/\.dg-btn\s*\{[^}]*font-size:\s*15px/);
  });

  it('41. .dg-input has height >= 48px', () => {
    expect(CSS_SRC).toMatch(/\.dg-input\s*\{[^}]*height:\s*48px/);
  });

  it('42. .dg-input font-size >= 16px (prevents iOS zoom)', () => {
    expect(CSS_SRC).toMatch(/\.dg-input\s*\{[^}]*font-size:\s*16px/);
  });

  it('43. .dg-challenge-sub font-size >= 14px', () => {
    expect(CSS_SRC).toMatch(/\.dg-challenge-sub\s*\{[^}]*font-size:\s*14px/);
  });

  it('44. .dg-row-label font-size >= 13px', () => {
    expect(CSS_SRC).toMatch(/\.dg-row-label\s*\{[^}]*font-size:\s*13px/);
  });

  it('45. .dg-row-value font-size >= 13px', () => {
    expect(CSS_SRC).toMatch(/\.dg-row-value\s*\{[^}]*font-size:\s*13px/);
  });

  it('46. .dg-phrase font-size >= 16px', () => {
    expect(CSS_SRC).toMatch(/\.dg-phrase\s*\{[^}]*font-size:\s*16px/);
  });

  it('47. All interactive elements have touch-action: manipulation', () => {
    const touchActionCount = (CSS_SRC.match(/touch-action:\s*manipulation/g) || []).length;
    expect(touchActionCount).toBeGreaterThanOrEqual(6);
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: No Passer in scored tests', () => {
  it('48. No "Passer" button in Stroop phase JSX', () => {
    const stroopMarker = "{phase === 'cognitive-stroop'";
    const digitMarker = "{phase === 'cognitive-digit-span'";
    const stroopSection = PAGE_SRC.slice(
      PAGE_SRC.indexOf(stroopMarker),
      PAGE_SRC.indexOf(digitMarker),
    );
    expect(stroopSection).not.toContain('Passer');
  });

  it('49. No "Passer" button in N-Back phase JSX', () => {
    const nbackMarker = "{phase === 'cognitive-nback'";
    const trailMarker = "{phase === 'cognitive-trail-tap'";
    const nbackSection = PAGE_SRC.slice(
      PAGE_SRC.indexOf(nbackMarker),
      PAGE_SRC.indexOf(trailMarker),
    );
    expect(nbackSection).not.toContain('Passer');
  });

  it('50. No "Passer" button in Digit Span phase JSX', () => {
    const digitMarker = "{phase === 'cognitive-digit-span'";
    const nbackMarker = "{phase === 'cognitive-nback'";
    const digitSection = PAGE_SRC.slice(
      PAGE_SRC.indexOf(digitMarker),
      PAGE_SRC.indexOf(nbackMarker),
    );
    expect(digitSection).not.toContain('Passer');
  });

  it('51. No "Passer" button in Trail Tap phase JSX', () => {
    const trailMarker = "{phase === 'cognitive-trail-tap'";
    const voiceMarker = "{phase === 'voice-proof'";
    const trailSection = PAGE_SRC.slice(
      PAGE_SRC.indexOf(trailMarker),
      PAGE_SRC.indexOf(voiceMarker),
    );
    expect(trailSection).not.toContain('Passer');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Progress strip', () => {
  it('52. .dg-progress-strip class exists in CSS', () => {
    expect(CSS_SRC).toContain('.dg-progress-strip');
  });

  it('53. .dg-progress-strip-fill class exists in CSS', () => {
    expect(CSS_SRC).toContain('.dg-progress-strip-fill');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: data-testid coverage', () => {
  it('54. Hero has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-hero"');
  });

  it('55. Stroop card has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-stroop-card"');
  });

  it('56. N-Back card has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-nback-card"');
  });

  it('57. Digit Span card has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-digit-span-card"');
  });

  it('58. Trail Tap card has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-trail-tap-card"');
  });

  it('59. Voice card has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-voice-card"');
  });

  it('60. Review card has data-testid', () => {
    expect(PAGE_SRC).toContain('data-testid="dg-review-card"');
  });
});

describe('DEMOGUARD-MOBILE-RESPONSIVE-01: Desktop enhancement', () => {
  it('61. @media (min-width: 480px) exists for desktop enhancements', () => {
    expect(CSS_SRC).toMatch(/@media\s*\(min-width:\s*480px\)/);
  });

  it('62. Desktop media query increases stroop word font-size', () => {
    const desktopSection = CSS_SRC.slice(CSS_SRC.indexOf('@media (min-width: 480px)'));
    expect(desktopSection).toContain('.dg-stroop-word');
    expect(desktopSection).toMatch(/font-size:\s*48px/);
  });
});
