# DEMOGUARD_MOBILE_SHELL_03_STABLE_LAYOUT_REPORT.md

**Date:** 2026-07-11  
**Author:** Cascade (IA SOLUTION)  
**Scope:** `payguard` repo — DemoGuard stable mobile app shell, no layout shift during tests  
**Task:** DEMOGUARD-MOBILE-SHELL-03

---

## 1. Cause exacte du changement de format

**Three root causes identified:**

### Cause 1: `@media (min-width: 480px)` breakpoint fires mid-test
On Chrome Android, when the user scrolls and the address bar hides, `window.innerWidth` can increase by 40-60px. On a 430px device, this pushes width past 480px → the media query triggers, changing:
- `.dg-page` padding from 12px to 16px
- `.dg-page` gap from 10px to 12px
- `.dg-stroop-word` font-size from 36px to 44px
- `.dg-hero` padding from 10px 12px to 14px 16px

**Result:** Sudden format change during Stroop test — the page narrows and re-centers.

### Cause 2: Double-nested containers with `margin: 0 auto`
- `.app-shell` (max-width 460px, margin: 0 auto)
- `.dg-page` (max-width 460px, margin: 0 auto)

Both center independently. When viewport width changes, the re-centering happens at two levels, causing visible shift.

### Cause 3: Inner `max-width` constraints narrower than card
- `.dg-stroop-grid` had `max-width: 320px` — narrower than the 430px frame
- `.dg-trail-area` had `max-width: 320px`
- `.dg-digit-keypad` had `max-width: 300px`

These created a "narrow band" visual effect inside the already-narrow frame.

---

## 2. Anciens wrappers problématiques

| Wrapper | Problem |
|---------|---------|
| `.app-shell` (460px) → `.dg-page` (460px) | Double centering, double margin auto |
| `.dg-page` with media query padding change | Format shift when breakpoint triggers |
| `.dg-card .dg-challenge-area` per phase | Different card per phase = different wrapper = layout shift |
| `.dg-stroop-grid` max-width 320px | Narrower than frame, visual narrowing |
| `.dg-trail-area` max-width 320px | Same issue |
| `.dg-digit-keypad` max-width 300px | Same issue |
| Camera result card shown during cognitive | Variable height card appearing/disappearing |
| Sticky bar `dg-sticky-mini` during cognitive | Steal vertical space |

---

## 3. Nouveau mobile app shell

```
<div className="dg-app-shell">
  <div className="dg-mobile-frame">
    <Header />
    <CompactStatusRow />
    <div className="dg-test-card">
      {cognitive phase content}
    </div>
    {non-cognitive content}
  </div>
</div>
```

### `.dg-app-shell`
- `width: 100%` — full viewport
- `min-height: 100dvh`
- `overflow-x: hidden`
- `display: flex; justify-content: center` — centers the frame
- No max-width — the frame handles that

### `.dg-mobile-frame`
- `width: min(100%, var(--dg-stable-frame-width, 430px))` — CSS variable from hook
- `max-width: 430px`
- `min-width: 0` — prevents flex overflow
- `padding` with safe-area insets
- `display: flex; flex-direction: column; gap: 10px`
- **Same width throughout entire session** — no phase changes it

---

## 4. Stable viewport strategy

### `useStableMobileViewport` hook (`src/hooks/useStableMobileViewport.ts`)

**Pure functions exported:**
- `computeStableFrameWidth(innerWidth, visualViewportWidth)` → `min(w, 430)`
- `isCognitivePhase(phase)` → true for 5 cognitive phases
- `shouldIgnoreViewportResizeDuringCognitive(prevWidth, newWidth, phase)` → true if delta ≤ 50px during cognitive

**Hook behavior:**
- Reads `window.innerWidth` and `visualViewport.width` at mount
- Computes `stableFrameWidth = min(width, 430)`
- Sets CSS variable `--dg-stable-frame-width` on `.dg-app-shell`
- Listens to `resize` and `visualViewport.resize`
- **During cognitive phases:** ignores width changes ≤ 50px (Chrome address bar show/hide)
- **Outside cognitive phases:** updates normally
- Dev-mode logging: `dg_viewport_metrics`, `dg_viewport_resize_ignored`, `dg_phase_change`

**Cognitive phases (width locked):**
- `cognitive-intro`
- `cognitive-stroop`
- `cognitive-digit-span`
- `cognitive-nback`
- `cognitive-trail-tap`

---

## 5. Cognitive card stable

### `.dg-test-card`
- `width: 100%` — fills frame
- `min-width: 0` — prevents flex overflow
- `min-height: clamp(360px, calc(100dvh - 230px), 560px)` — stable height
- `overflow: hidden` — no content escapes
- `box-sizing: border-box`
- `flex-shrink: 0`
- `display: flex; flex-direction: column`

**All 5 cognitive phases render inside this single card.** The phase changes only the inner content, never the wrapper. No card mount/unmount between phases = no layout shift.

---

## 6. Status row compact

### `.dg-compact-status-row`
- `height: 36px` — fixed, no wrapping
- `overflow: hidden; white-space: nowrap`
- `flex-shrink: 0`
- Shows: `Photo ✓ | Micro ✓ | Touch ✓`
- Visible during cognitive phases and voice-proof
- Replaces the old camera result card (variable height)

### `.dg-cs-chip`
- `padding: 4px 8px; font-size: 11px`
- `flex-shrink: 0; white-space: nowrap`
- `.dg-cs-ok` (green) or `.dg-cs-missing` (gray)

---

## 7. Stroop stable layout

| Property | Before | After |
|----------|--------|-------|
| Grid | `repeat(2, 1fr)` max-width 320px | `repeat(2, minmax(0, 1fr))` width 100% |
| Word font-size | 36px fixed | `clamp(34px, 11vw, 46px)` |
| Word overflow | not set | `overflow-wrap: anywhere` |
| Media query 480px | Changed to 44px | **Removed** — no font change |

The `minmax(0, 1fr)` prevents grid blowout when content is wider than the cell. The `clamp` font-size scales with viewport but never exceeds 46px. No media query override means no format change at 480px.

---

## 8. Trail Tap stable layout

| Property | Before | After |
|----------|--------|-------|
| Width | `width: 100%; max-width: 320px` | `width: 100%` (no max-width) |
| Height | `clamp(280px, 45vh, 380px)` | `clamp(300px, calc(100dvh - 320px), 420px)` |
| Box-sizing | not set | `border-box` |

Trail Tap area now fills the full test card width. Height adapts to available viewport minus header/status/card padding. `ResizeObserver` measures the actual area element (not window) and recomputes node positions.

---

## 9. Horizontal overflow prevention

### `index.css` global rules:
```css
* { box-sizing: border-box; }
img, video, canvas, svg { max-width: 100%; }
html, body, #root { margin: 0; width: 100%; overflow-x: hidden; }
```

### CSS audit:
- No `width: fit-content`, `max-content`, or `min-content` anywhere
- No negative margins in cognitive-related CSS
- All grids use `minmax(0, 1fr)` to prevent blowout
- All internal elements use `width: 100%` not fixed px

---

## 10. Tests results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vite build` | ✅ Built in 1.23s (193.53 KB JS, 13.92 KB CSS) |
| `demoguard-mobile-shell-03.test.ts` | ✅ 42/42 passed |
| `demoguard-mobile-responsive-01.test.ts` | ✅ 62/62 passed |
| `demoguard-mobile-responsive-02.test.ts` | ✅ 28/28 passed |
| **Total** | **✅ 132/132 passed** |

### Shell-03 test coverage (42 tests)

| Suite | Tests | Coverage |
|-------|-------|----------|
| Pure functions | 10 | computeStableFrameWidth, shouldIgnoreViewportResize, isCognitivePhase, COGNITIVE_PHASES, MAX_FRAME_WIDTH, trail tap clamping |
| CSS structure | 16 | Shell width, frame CSS var, no desktop switch, Stroop minmax grid, trail area width 100%, test card stable, no .dg-page, global box-sizing |
| JSX structure | 16 | dg-app-shell root, dg-mobile-frame, CSS variable, single test card, no dg-card dg-challenge-area in cognitive, signals hidden, sticky hidden, compact status row, no overflow patterns |

---

## 11. Manual real-device checklist

### Chrome Android (360px – 430px)

- [ ] **Chrome Android avec barre d'adresse visible** — Démarrer DemoGuard, vérifier largeur stable
- [ ] **Chrome Android après scroll/barre réduite** — La largeur ne change pas pendant les tests
- [ ] **360px largeur** — Page entière visible, pas de débordement
- [ ] **390px largeur** — Même comportement que 360px
- [ ] **Couleurs : 6 essais sans changement de format** — La page ne se rétrécit pas, ne se recentre pas
- [ ] **Comparaison avant/après : aucun changement de format** — Prendre screenshot avant Stroop et après 3 taps, comparer
- [ ] **Mémoire : clavier ne s'ouvre pas** — Les champs de saisie ne déclenchent pas le clavier pendant les tests cognitifs
- [ ] **Chemin : tous les points visibles** — Aucun point coupé, tous dans la zone
- [ ] **Voice : pas de layout shift** — Le passage aux tests vocaux ne change pas la largeur
- [ ] **Review : interactions visibles** — Le résumé affiche tous les résultats
- [ ] **Aucun scroll horizontal** — La page ne déborde jamais horizontalement
- [ ] **Sticky bar visible seulement en review/submit/done/error** — Pas de barre pendant les tests

### Safari iOS (safe areas)

- [ ] **Safe area top** — Le contenu n'est pas sous le notch
- [ ] **Safe area bottom** — Le contenu n'est pas sous le home indicator
- [ ] **Pas de zoom input** — Font-size 16px sur les inputs

### Résolutions à tester

- [ ] 360×640 (Samsung Galaxy S20 FE)
- [ ] 375×667 (iPhone SE)
- [ ] 390×844 (iPhone 14)
- [ ] 412×915 (Pixel 7)
- [ ] 430×932 (iPhone 14 Pro Max)

---

## 12. GO / NO-GO

### ✅ GO

**Justification:**
- **Root cause identifiée et éliminée:** Le breakpoint `@media (min-width: 480px)` qui changeait padding/gap/font-size a été neutralisé pour les propriétés critiques
- **Shell stable:** `.dg-app-shell` + `.dg-mobile-frame` avec CSS variable `--dg-stable-frame-width` — la largeur ne change jamais pendant les tests cognitifs
- **Hook `useStableMobileViewport`:** Ignore les changements de viewport ≤ 50px pendant les phases cognitives (barre d'adresse Chrome)
- **Carte de test unique:** `.dg-test-card` wrapper pour les 5 phases cognitifs — pas de montée/démontage de carte entre phases
- **Status row compact:** 36px fixe, remplace l'ancienne card Photo variable
- **Grids `minmax(0, 1fr)`:** Prevent grid blowout
- **No `max-width` on inner elements:** Stroop grid, trail area, digit keypad utilisent `width: 100%`
- **132/132 tests passent**, 0 erreurs TS, build OK

**Risque résiduel:** Test réel sur device physique requis pour validation finale (checklist section 11).

---

## Files Modified

| File | Changes |
|------|---------|
| `src/hooks/useStableMobileViewport.ts` | **New file:** Hook + pure functions for stable viewport width during cognitive phases |
| `src/pages/DemoGuard.tsx` | Root structure: `.dg-page` → `.dg-app-shell` + `.dg-mobile-frame`; import hook; CSS variable; compact status row; single `dg-test-card` for all cognitive phases; removed camera result card during cognitive |
| `src/pages/demoguard-premium.css` | `.dg-page` → `.dg-app-shell` + `.dg-mobile-frame`; `.dg-test-card` + `.dg-compact-status-row` + `.dg-cs-chip` styles; Stroop grid `minmax(0,1fr)` width 100%; Stroop word `clamp` font; trail area width 100% no max-width; digit keypad width 100%; media query no longer changes Stroop word or padding; light mode `.dg-page` → `.dg-app-shell` |
| `src/index.css` | Added `img, video, canvas, svg { max-width: 100% }` |
| `tests/demoguard-mobile-shell-03.test.ts` | **New file:** 42 tests |
| `tests/demoguard-mobile-responsive-01.test.ts` | 10 assertions updated for new CSS structure |
| `tests/demoguard-mobile-responsive-02.test.ts` | 2 assertions updated for new CSS |

---

*© 2026 Benjamin BARRERE / IA SOLUTION — Patents Pending FR2514274 | FR2514546*
