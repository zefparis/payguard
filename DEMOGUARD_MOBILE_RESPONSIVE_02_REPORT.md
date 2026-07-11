# DEMOGUARD_MOBILE_RESPONSIVE_02_REPORT.md

**Date:** 2026-07-11  
**Author:** Cascade (IA SOLUTION)  
**Scope:** `payguard` repo — DemoGuard real mobile responsiveness fix  
**Task:** DEMOGUARD-MOBILE-RESPONSIVE-02

---

## 1. Cause exacte du Chemin impossible

**Root cause:** `generateTrailTapNodes()` in `trailTapChallenge.ts` generated random pixel coordinates in a fixed 300×400 virtual space, but the CSS `.dg-trail-area` was 320×340px with `overflow: hidden`.

- Nodes with `y > 340` were clipped by `overflow: hidden` — invisible and untappable
- Nodes with `x > 320` were also clipped
- The 48px node width was not accounted for in positioning — nodes at `x=280` had their right edge at `x=328`, overflowing the 320px area
- No measurement of the actual rendered area was done — positions were pure random in a virtual space that didn't match reality

**Fix:** Replaced fixed random generation with a normalized coordinate system + dynamic layout computation:
- 5 predefined normalized points (0..1 range) ensure consistent test difficulty
- `computeTrailTapLayout(areaWidth, areaHeight, points, radius)` converts normalized coords to actual px, clamped within `[padding, areaSize - padding]`
- `ResizeObserver` measures the actual rendered area and recomputes positions on viewport changes

---

## 2. Problèmes responsive trouvés

| Problem | Impact |
|---------|--------|
| Trail nodes used fixed 300×400 random coords in 320×340 area | Nodes clipped, test impossible |
| Node width 48px not subtracted from position | Right-edge overflow |
| Signals panel visible during cognitive tests | Layout shift when signals arrive |
| Sticky bar showed as `dg-sticky-mini` during tests | Steal vertical space, shift layout |
| Header padding 12px 14px + title 18px | Too tall on 360px screens |
| Stroop word 42px not centered | Visual confusion |
| Stroop instructions unclear | Users didn't know to pick text color vs word |
| Trail area fixed height 340px | Doesn't adapt to Chrome address bar show/hide |

---

## 3. Modifications container

| Property | Before | After |
|----------|--------|-------|
| `.dg-page` max-width | 460px | 460px (unchanged) |
| `.dg-page` min-height | 100dvh | 100dvh (unchanged) |
| `.dg-page` overflow-x | hidden | hidden (unchanged) |
| `.dg-trail-area` height | 340px fixed | `clamp(280px, 45vh, 380px)` |
| `.dg-trail-area` touch-action | not set | `manipulation` |

---

## 4. Modifications header/readiness

| Property | Before | After |
|----------|--------|-------|
| `.dg-hero` padding | 12px 14px | 10px 12px |
| `.dg-hero` border-radius | 12px | 10px |
| `.dg-hero` flex-shrink | not set | 0 (prevents shrink) |
| `.dg-hero-title` font-size | 18px | 16px |
| `.dg-hero-meta` margin-top | 8px | 6px |
| Desktop `.dg-hero` padding | 16px 18px | 14px 16px |
| Desktop `.dg-hero-title` | 20px | 18px |

Signals panel now hidden during all cognitive phases: `cognitive-stroop`, `cognitive-digit-span`, `cognitive-nback`, `cognitive-trail-tap`, `voice-proof`, `cognitive-intro`.

---

## 5. Modifications Couleurs

| Change | Details |
|--------|---------|
| Instructions | "Touche la **couleur du texte**, pas le mot écrit." |
| Example | "Exemple : si le mot « ROUGE » est écrit en bleu, touche « Bleu »." |
| Trial counter | Separate line with opacity 0.7 |
| Stroop word | Centered, 36px (was 42px, not centered) |
| Button font-size | 17px (was 16px) |
| Button flex centering | Added `display: flex; align-items: center; justify-content: center` |
| Desktop stroop word | 44px (was 48px) |

---

## 6. Modifications Trail Tap dynamique

### `trailTapChallenge.ts`

New exports:
- `NormalizedTrailPoint` interface — `{ id, nx, ny }` with 0..1 coordinates
- `NORMALIZED_TRAIL_POINTS` — 7 predefined points (5 used by default)
- `generateNormalizedTrailPoints(count)` — returns sliced predefined points
- `computeTrailTapLayout(w, h, points, radius)` — pure function, converts normalized to px with clamping
- `computeNodeRadius(areaWidth)` — returns `clamp(20, areaWidth * 0.08, 32)`

Clamping logic:
```
padding = radius + 8
x = round(padding + clamp(nx, 0, 1) * (width - padding * 2))
y = round(padding + clamp(ny, 0, 1) * (height - padding * 2))
```

### `DemoGuard.tsx`

- `trailAreaRef` + `trailAreaSize` state for measurement
- `trailNormalizedRef` stores normalized points (set once when entering trail phase)
- `ResizeObserver` effect: measures area on mount + resize, recomputes node positions
- JSX: node `left = node.x - radius`, `top = node.y - radius`, `width = height = radius * 2`
- Node size dynamic via `computeNodeRadius(trailAreaSize.w)`
- `data-testid="dg-trail-node-{id}"` on each node

### CSS

- `.dg-trail-node`: removed fixed `width: 48px; height: 48px; border-radius: 24px` — now set via JSX inline styles
- Added `display: flex; align-items: center; justify-content: center; user-select: none`
- Added `:active` state: `transform: scale(0.92); border-color: var(--dg-green)`

---

## 7. Gestion viewport mobile

- **100dvh** used on `.dg-page` and `.app-shell` — handles Chrome address bar show/hide
- **`clamp(280px, 45vh, 380px)`** for trail area height — adapts to available viewport
- **ResizeObserver** recomputes trail node positions when viewport changes (address bar, keyboard)
- **Safe-area insets** on top and bottom padding
- **No sticky bar during cognitive phases** — prevents layout shift
- **Signals panel hidden during cognitive phases** — prevents cards appearing/disappearing

---

## 8. Tests results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vite build` | ✅ Built in 1.16s (193.53 KB JS, 12.87 KB CSS) |
| `demoguard-mobile-responsive-01.test.ts` | ✅ 62/62 passed |
| `demoguard-mobile-responsive-02.test.ts` | ✅ 28/28 passed |
| Total mobile responsive tests | ✅ 90/90 passed |

### Test coverage (02 tests)

| Suite | Tests | Coverage |
|-------|-------|----------|
| computeTrailTapLayout clamping | 13 | All points inside bounds, 5 viewport widths, resize order preservation, radius clamping, backward compat |
| CSS structure | 5 | 2x2 grid, min-height 64px, compact header, clamp height, no fixed height |
| JSX structure | 10 | No sticky-mini, sticky visible only in review/submit, dynamic trail positions, signals hidden, Stroop example, ref + testid |

---

## 9. Checklist test réel

### Chrome Android (360px – 430px)

- [ ] **Test Couleurs lisible** — Instructions claires, exemple visible, boutons 2x2 lisibles
- [ ] **Chemin — tous points visibles** — Aucun point coupé sur la droite ou en bas
- [ ] **Chemin — aucun point coupé** — Tous les cercles sont entièrement dans la zone
- [ ] **Aucun scroll horizontal** — Page ne déborde pas horizontalement
- [ ] **Pas de changement brutal de format** — Pas de layout shift pendant les tests
- [ ] **Review affiche interactions** — Le résumé montre les résultats de tous les tests
- [ ] **Barre d'adresse Chrome** — Le test reste jouable quand la barre apparaît/disparaît
- [ ] **Header compact** — Le header ne prend pas plus de ~90px sur 360px

### Safari iOS (safe areas)

- [ ] **Safe area top** — Le contenu n'est pas sous le notch
- [ ] **Safe area bottom** — Le contenu n'est pas sous le home indicator
- [ ] **Input ne zoome pas** — Font-size 16px sur les inputs

### Résolutions à tester

- [ ] 360×640 (Samsung Galaxy S20 FE)
- [ ] 375×667 (iPhone SE)
- [ ] 390×844 (iPhone 14)
- [ ] 412×915 (Pixel 7)
- [ ] 430×932 (iPhone 14 Pro Max)

---

## 10. GO / NO-GO

### ✅ GO

**Justification:**
- Trail Tap utilise des coordonnées normalisées clampées — impossible qu'un point sorte de la zone
- `computeTrailTapLayout` testé avec 5 largeurs d'écran différentes (360, 375, 390, 412, 430)
- `ResizeObserver` recalcule les positions si le viewport change
- Aucun sticky bar pendant les tests cognitifs
- Signaux panel caché pendant les tests — pas de layout shift
- Header compact (10px padding, 16px title)
- Stroop a un exemple et des instructions claires
- 90/90 tests passent, 0 erreurs TS, build OK

**Risque résiduel:** Test réel sur device physique requis pour validation finale (checklist section 9).

---

## Files Modified

| File | Changes |
|------|---------|
| `src/demoguard/cognitive/trailTapChallenge.ts` | +44 lines: NormalizedTrailPoint, computeTrailTapLayout, computeNodeRadius, generateNormalizedTrailPoints |
| `src/pages/DemoGuard.tsx` | ~40 lines: imports, trail refs/state, ResizeObserver effect, Stroop instructions, trail JSX, signals visibility, sticky bar |
| `src/pages/demoguard-premium.css` | ~20 lines: hero compact, trail area clamp, trail node dynamic, stroop word/button, sticky-mini removed, desktop query |
| `tests/demoguard-mobile-responsive-01.test.ts` | 6 assertions updated for new CSS values |
| `tests/demoguard-mobile-responsive-02.test.ts` | New: 28 tests |

---

*© 2026 Benjamin BARRERE / IA SOLUTION — Patents Pending FR2514274 | FR2514546*
