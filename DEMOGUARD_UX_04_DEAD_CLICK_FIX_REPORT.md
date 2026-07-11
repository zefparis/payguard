# DEMOGUARD-UX-04-FIX — Dead-Click & Blocking Feedback Fix Report

**Date:** 2026-07-11  
**Author:** Cascade (IA SOLUTION)  
**Status:** ✅ COMPLETE  
**Repo:** payguard  
**Task ID:** DEMOGUARD-UX-04-FIX

---

## 1. Cause exacte des clics dans le vide

Cinq root causes identifiées dans `src/pages/DemoGuard.tsx`:

### 1A. Stroop practice: `setTimeout` 1200–1500ms bloquant

```ts
// AVANT (handleStroopPracticeSelect):
setStroopPracticeFeedback(correct ? 'Compris ! Continue.' : 'Non — ...');
if (last practice trial) {
  window.setTimeout(() => {
    setStroopPracticeMode(false);
    setStroopPracticeFeedback(null);
  }, 1500);  // ← 1.5s dead zone
} else {
  window.setTimeout(() => {
    setStroopPracticeIndex((i) => i + 1);
    setStroopPracticeFeedback(null);
  }, 1200);  // ← 1.2s dead zone
}
```

Pendant 1200–1500ms, les boutons étaient visibles mais le handler `handleStroopPracticeSelect` rejetait tous les taps car `stroopPracticeFeedback` était set. L'utilisateur tapait dans le vide.

### 1B. N-Back practice: `setTimeout` 1200–1500ms bloquant

Même pattern que Stroop — feedback "Compris ! Continue." / "C'était OUI..." affiché pendant 1200–1500ms avec boutons visibles mais morts.

### 1C. Reflex `too_early`: 1200ms dead zone

```ts
// AVANT: quand l'utilisateur tapait trop tôt:
setCogReflexPhase('too_early');
// useEffect: setTimeout(() => setCogReflexPhase('ready'), 1200)
// Pendant 1200ms: bouton visible "TROP TÔT" mais tap ne faisait rien
```

### 1D. Pas de protection anti double-tap sur Stroop/N-Back scored

Un double-tap rapide sur un bouton de couleur pouvait enregistrer deux résultats pour le même essai, corrompant `stroopResults` et potentiellement sautant un essai.

### 1E. Boutons "Passer" sur tous les tests scorés

Les boutons "Passer" étaient présents sur Stroop, Digit Span, N-Back, et Trail Tap. Ils permettaient de sauter un test entier accidentellement, créant de la confusion.

---

## 2. Feedbacks supprimés ou rendus non bloquants

| Feedback | Avant | Après |
|----------|-------|-------|
| Stroop practice "Compris ! Continue." | Bloque 1200ms | **Supprimé** — passage immédiat |
| Stroop practice "Non — appuie sur la couleur..." | Bloque 1200ms | **Supprimé** — passage immédiat |
| N-Back practice "Compris ! Continue." | Bloque 1200ms | **Supprimé** — passage immédiat |
| N-Back practice "C'était OUI/NON..." | Bloque 1200ms | **Supprimé** — passage immédiat |
| Reflex "TROP TÔT" | Dead zone 1200ms | **Tap actif** — tap remet à 'ready' immédiatement |

State variables supprimées:
- `stroopPracticeFeedback` / `setStroopPracticeFeedback`
- `nbackPracticeFeedback` / `setNbackPracticeFeedback`

---

## 3. Modules corrigés

### 3A. Couleurs / Stroop (`handleStroopPracticeSelect` + `handleStroopSelect`)

**Practice:**
- Suppression des `setTimeout` 1200ms/1500ms
- Suppression du feedback `stroopPracticeFeedback`
- Tap → `recordStroopSelection()` → `setStroopPracticeIndex(i+1)` immédiat
- Dernier essai practice → `setStroopPracticeMode(false)` immédiat (transition auto)

**Scored:**
- Ajout `stroopAdvancingRef` (anti double-tap)
- Tap → guard check → `recordStroopSelection()` → `setStroopIndex(i+1)` immédiat
- Guard relâché après 150ms (`setTimeout` non bloquant)
- Dernier essai → `setPhase('cognitive-digit-span')` immédiat

### 3B. Comparaison / N-Back (`handleNBackPracticeResponse` + `handleNBackResponse`)

**Practice:**
- Suppression des `setTimeout` 1200ms/1500ms
- Suppression du feedback `nbackPracticeFeedback`
- Tap → `recordNBackDecision()` → `setNbackPracticeIndex(i+1)` immédiat
- Dernier essai practice → `setNbackPracticeMode(false)` immédiat (transition auto)

**Scored:**
- Ajout `nbackAdvancingRef` (anti double-tap)
- Tap → guard check → `recordNBackDecision()` → `setNbackIndex(i+1)` immédiat
- Guard relâché après 150ms

### 3C. Mémoire courte / Digit Span (`handleDigitSpanSubmit`)

- Boutons 0-9: toujours actifs (pas de `disabled`)
- Bouton Effacer: toujours actif
- Bouton Valider: `disabled` seulement si input vide
- Submit → `setDigitSpanIndex(i+1)` + `setDigitSpanShowDigits(true)` immédiat
- Bouton "Passer" supprimé

### 3D. Chemin / Trail Tap (`handleTrailTap`)

- Tap correct → `setTrailEvents(next)` immédiat, avance au prochain point
- Tap incorrect → `recordTrailTap(false, ...)` + `setTrailEvents(next)` — ne bloque pas
- Dernier point correct → `setPhase('voice-proof')` immédiat
- Bouton "Passer" supprimé

### 3E. Réflexe (`handleCogReflexTap`)

- `too_early` → tap remet à `ready` immédiatement (plus de dead zone 1200ms)

---

## 4. Logique anti double-tap

```ts
// Pattern appliqué à Stroop et N-Back scored handlers:

const stroopAdvancingRef = useRef(false);
const nbackAdvancingRef = useRef(false);

const handleStroopSelect = useCallback((color: StroopColor) => {
  // ... guards ...
  if (stroopAdvancingRef.current) return;  // ← ignore double tap
  stroopAdvancingRef.current = true;       // ← lock
  // ... record + advance ...
  window.setTimeout(() => { stroopAdvancingRef.current = false; }, 150);  // ← release after 150ms
}, [...]);
```

**Propriétés:**
- `isAdvancing = true` → taps supplémentaires ignorés silencieusement (pas de freeze)
- Lock relâché après 150ms (non bloquant — l'essai suivant est déjà affiché)
- Pas d'écran vide entre essais
- Idempotent: un seul résultat enregistré par tap intentionnel

---

## 5. Behavior recording confirmé

| Module | Handler | Recorder appelé | Practice compté |
|--------|---------|-----------------|-----------------|
| Réflexe | `handleCogReflexTap` | `recordReflexTap()` + `recordTaskStart('reflex')` | N/A |
| Couleurs practice | `handleStroopPracticeSelect` | `recordStroopSelection()` + `recordTaskStart('stroop')` | ✅ |
| Couleurs scored | `handleStroopSelect` | `recordStroopSelection()` + `recordTaskStart('stroop')` | N/A |
| Mémoire | `handleDigitSpanSubmit` + buttons | `recordDigitSpanKey()` + `recordDigitSpanSubmit()` + `recordTaskStart('digit_span')` | N/A |
| Comparaison practice | `handleNBackPracticeResponse` | `recordNBackDecision()` + `recordTaskStart('n_back')` | ✅ |
| Comparaison scored | `handleNBackResponse` | `recordNBackDecision()` + `recordTaskStart('n_back')` | N/A |
| Chemin | `handleTrailTap` | `recordTrailTap()` + `recordTaskStart('trail_tap')` | N/A |

---

## 6. Boutons "Passer" supprimés

| Module | Avant | Après |
|--------|-------|-------|
| Couleurs (scored) | `<button>Passer</button>` → `handleSkipStroop` | **Supprimé** |
| Mémoire courte | `<button>Passer</button>` → `handleSkipDigitSpan` | **Supprimé** |
| Comparaison (scored) | `<button>Passer</button>` → `handleSkipNBack` | **Supprimé** |
| Chemin | `<button>Passer</button>` → `handleSkipTrailTap` | **Supprimé** |

Handlers supprimés: `handleSkipStroop`, `handleSkipDigitSpan`, `handleSkipNBack`, `handleSkipTrailTap`.

---

## 7. Tests results

### Tests UX-04 (nouveau fichier)
```
tests/demoguard-ux04-dead-click-fix.test.ts — 31 tests
✅ All 31 passed
```

### Tests UX-03 (régression)
```
tests/demoguard-ux03-touch-guard-fix.test.ts — 27 tests
✅ All 27 passed
```

### Tests UX-02 (régression)
```
tests/demoguard-ux02-rebuild.test.ts — 36 tests
✅ All 36 passed
```

### Tests behavior (régression)
```
tests/p10-behavior-integrated-touch.test.ts — 19 tests
✅ All 19 passed
```

### Total
```
4 test files — 113 tests — ALL PASSED
```

### TypeScript
```
npx tsc --noEmit — exit 0 ✅
```

### Build
```
npm run build — exit 0 ✅
  dist/assets/index-AazeYqX2.js   193.53 kB │ gzip: 63.15 kB
```

---

## 8. GO / NO-GO test réel téléphone

### ✅ GO

**Justification:**
- Aucun `setTimeout` bloquant (1200ms/1500ms) dans les handlers de practice
- Les boutons de couleur OUI/NON répondent immédiatement à chaque tap
- Anti double-tap guard empêche la corruption d'état sans bloquer l'UI
- Reflex `too_early` — tap remet à `ready` immédiatement (plus de dead zone)
- Boutons "Passer" supprimés des tests scorés — plus de saut accidentel
- Practice → scored: transition automatique immédiate (plus d'écran de feedback bloquant)
- Tous les taps (practice + scored) incrémentent `behaviorInteractions`
- TypeScript compile, build réussit, 113 tests passent

**Test réel à vérifier sur téléphone:**
1. Test 1 Réflexe — taper trop tôt → "TROP TÔT" → re-taper immédiatement → doit remettre à "TAP POUR COMMENCER"
2. Test 2 Couleurs practice — taper une couleur → passage immédiat au suivant (pas de "Compris ! Continue.")
3. Test 2 Couleurs scored — double tap rapide sur une couleur → un seul résultat enregistré, pas de freeze
4. Test 3 Mémoire — boutons 0-9 toujours actifs, Valider avance immédiat
5. Test 4 Comparaison practice — OUI/NON → passage immédiat (pas de "Compris ! Continue.")
6. Test 4 Comparaison scored — double tap rapide → un seul résultat, pas de freeze
7. Test 5 Chemin — taper mauvais point → ne bloque pas, peut continuer
8. Vérifier: aucun bouton "Passer" visible pendant les tests scorés
