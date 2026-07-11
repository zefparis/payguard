# DEMOGUARD-UX-03-FIX — Touch Guard & Interaction Counter Fix Report

**Date:** 2026-07-11  
**Author:** Cascade (IA SOLUTION)  
**Status:** ✅ COMPLETE  
**Repo:** payguard  
**Task ID:** DEMOGUARD-UX-03-FIX

---

## 1. Cause exacte du blocage pendant Couleurs

Two root causes identified:

### 1A. `behaviorBlocked` non-gated par phase

**Ligne coupable (avant):**
```ts
const behaviorBlocked = behaviorTouchSupported && behaviorInteractions === 0;
```

Cette expression ne vérifiait pas la phase. Pendant les tests cognitifs (`cognitive-stroop`, `cognitive-nback`, etc.), `behaviorSummary` est `null` (seulement calculé dans `finishToReview`), donc `behaviorInteractions = 0` → `behaviorBlocked = true` sur mobile.

### 1B. Sticky bar affichait "Bloqué" pour toute phase ≠ idle

**Ligne coupable (avant):**
```tsx
{submitBlockReasons.length > 0 ? (
  <>Bloqué...</>
```

Le sticky bar vérifiait `submitBlockReasons.length > 0` sans filtrer par phase. Comme `behaviorBlocked` était `true` pendant les tests, `submitBlockReasons` contenait "Pas assez d'interactions tactiles détectées" → le message "BLOQUÉ" s'affichait pendant Couleurs, Comparaison, Mémoire, Chemin.

### 1C. Practice handlers ne recordaient pas les interactions

`handleStroopPracticeSelect` (Stroop practice) et `handleNBackPracticeResponse` (N-Back practice) ne appelaient **pas** `recordStroopSelection` / `recordNBackDecision`. Seuls les handlers des trials réels enregistraient les interactions. Sur mobile, l'utilisateur tapait sur Rouge/Bleu/Vert/Jaune en practice, mais aucun `recordInteraction('stroop')` n'était appelé.

---

## 2. Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/pages/DemoGuard.tsx` | Gate `behaviorBlocked` sur `phase === 'readiness' \|\| phase === 'review'` |
| `src/pages/DemoGuard.tsx` | Sticky bar: `phase === 'readiness' && submitBlockReasons.length > 0` |
| `src/pages/DemoGuard.tsx` | `handleStroopPracticeSelect`: ajout `recordTaskStart('stroop')` + `recordStroopSelection()` |
| `src/pages/DemoGuard.tsx` | `handleNBackPracticeResponse`: ajout `recordTaskStart('n_back')` + `recordNBackDecision()` |
| `src/pages/DemoGuard.tsx` | Review screen: ajout block/warning/success tri-state + tasksObserved debug |
| `tests/demoguard-ux03-touch-guard-fix.test.ts` | Nouveau: 27 tests couvrant tous les scénarios |

---

## 3. Modules instrumentés

| Module | Handler | Recorder | Status |
|--------|---------|----------|--------|
| **Réflexe** | `handleCogReflexTap` | `recordReflexTap()` + `recordTaskStart('reflex')` | ✅ Déjà instrumenté |
| **Couleurs (practice)** | `handleStroopPracticeSelect` | `recordStroopSelection()` + `recordTaskStart('stroop')` | ✅ **Corrigé** |
| **Couleurs (trials)** | `handleStroopSelect` | `recordStroopSelection()` + `recordTaskStart('stroop')` | ✅ Déjà instrumenté |
| **Mémoire courte** | `handleDigitSpanSubmit` + numeric buttons | `recordDigitSpanKey()` + `recordDigitSpanSubmit()` + `recordTaskStart('digit_span')` | ✅ Déjà instrumenté |
| **Comparaison (practice)** | `handleNBackPracticeResponse` | `recordNBackDecision()` + `recordTaskStart('n_back')` | ✅ **Corrigé** |
| **Comparaison (trials)** | `handleNBackResponse` | `recordNBackDecision()` + `recordTaskStart('n_back')` | ✅ Déjà instrumenté |
| **Chemin** | `handleTrailTap` | `recordTrailTap()` + `recordTaskStart('trail_tap')` | ✅ Déjà instrumenté |
| **Voix** | `handleStartVoiceCountdown` | Non requis (pas tactile) | N/A |

---

## 4. Nouvelle logique guard

### Pendant les tests cognitifs
- **Jamais** de message "BLOQUÉ"
- Les interactions tactiles sont enregistrées en continu
- L'utilisateur peut naviguer librement entre les modules

### À l'écran Review (`phase === 'review'`)

```
if touchSupported && totalInteractions === 0:
  → blockSubmit = true
  → message = "Nous n'avons pas détecté assez d'interactions tactiles. Refais les tests tactiles avant d'envoyer."

else if totalInteractions > 0 && totalInteractions < 5:
  → blockSubmit = false
  → warning = "⚠️ Signature tactile faible — le résultat pourrait être en révision."

else if totalInteractions >= 5:
  → blockSubmit = false
  → status = "✓ Signature tactile détectée."
```

### Sticky bar
- "Bloqué" ne s'affiche **que** pendant `phase === 'readiness'` avec `submitBlockReasons.length > 0`
- Pendant les tests: "En cours" avec le nom de l'étape

---

## 5. Tests results

### Tests UX-03 (nouveau fichier)
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

### Tests touch collector (régression)
```
tests/p10-touch-collector.test.ts — 19 tests
✅ All 19 passed
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

### Pre-existing failures (non-related)
- `tests/demoguard-cognitive-battery.test.ts`: 1 test fails on `voice_b64` string check (pre-existing, sensitive data handling)
- `tests/p10-final-touch-runtime.test.ts`: 1 test fails on English labels "Motor confidence"/"Behavioral Touch" (pre-existing, replaced by French in UX-02)

---

## 6. GO / NO-GO test réel téléphone

### ✅ GO

**Justification:**
- Le guard "BLOQUÉ" ne peut plus s'afficher pendant les tests cognitifs (gate par phase)
- Les boutons Couleurs practice et Comparaison practice enregistrent maintenant les interactions
- Le review screen affiche le statut tactile complet (block/warning/success)
- Le snapshot n'est pas reset avant submit (un seul `resetTouchBehaviorCollector()` dans `handleStart`)
- TypeScript compile, build réussit, tous les tests UX-03 passent

**Test réel à vérifier sur téléphone:**
1. Démarrer DemoGuard → passer les tests Couleurs/Comparaison/Mémoire/Chemin
2. Vérifier: aucun message "BLOQUÉ" pendant les tests
3. Arriver à Review → vérifier "X interactions" et "Y / 6 tests observés"
4. Si interactions ≥ 5 → "✓ Signature tactile détectée"
5. Si 0 < interactions < 5 → warning jaune
6. Si 0 interactions → message d'erreur rouge + submit bloqué
