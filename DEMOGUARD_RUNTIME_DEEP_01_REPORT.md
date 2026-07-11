# DEMOGUARD-RUNTIME-DEEP-01 — Deep Debug Mobile Cognitive Freeze + Redis WRONGTYPE Audit

**Date:** 2026-07-11  
**Author:** Cascade (IA SOLUTION)  
**Status:** ✅ COMPLETE  
**Repos:** payguard, hcs-u7-admin, hcs-u7-backend  
**Task ID:** DEMOGUARD-RUNTIME-DEEP-01

---

## 1. Reproduction du freeze mobile

### Symptôme observé

Après DEMOGUARD-UX-04-FIX, le test Couleurs bloque encore en réel mobile:
- Écran : Test 2 — Couleurs, Essai 1/6
- À partir du 3e clic, le test semble bloqué
- Plus d'avancement clair
- Phase affichée en bas : `cognitive-stroop`
- Aucun message BLOQUÉ

### Reproduction logique

Le freeze n'est pas un crash — c'est un **stale closure** de React. Le handler `handleStroopSelect` capturait `stroopResults` (state) dans son `useCallback` deps array. Quand l'utilisateur tapait rapidement:

1. **Tap 1** → `setStroopResults([r1])` → React programme un re-render
2. **Tap 2** → handler encore avec ancien `stroopResults = []` → `next = [r1]` (au lieu de `[r1, r2]`) → écrase le résultat → `setStroopResults([r1])` → `setStroopIndex(1)` (devrait être 2)
3. **Tap 3** → handler avec `stroopResults = [r1]` (stale) → `next = [r1, r3]` → mais `stroopIndex` peut être désynchronisé
4. L'index et les résultats se désynchronisent → l'UI affiche un essai qui ne correspond pas à l'état interne → l'utilisateur a l'impression que ça bloque

### Cause exacte

**Root cause : `stroopResults` state dans les deps de `useCallback`**

```ts
// AVANT (buggy):
const handleStroopSelect = useCallback((color: StroopColor) => {
  // ...
  const next = [...stroopResults, result];  // ← stale closure!
  setStroopResults(next);
  // ...
  window.setTimeout(() => { stroopAdvancingRef.current = false; }, 150);
}, [phase, stroopIndex, stroopTrials, stroopResults]);  // ← stroopResults triggers re-create but too late
```

**Deux problèmes combinés:**
1. **Stale closure**: `stroopResults` est lu dans le handler mais sa valeur est celle du render au moment de la création du callback. Si l'utilisateur tape plus vite que React ne re-render, le handler utilise une version obsolète de `stroopResults`.
2. **setTimeout pour le guard release**: Le `stroopAdvancingRef` était relâché via `setTimeout(150ms)`. Si une exception se produisait pendant le traitement, le ref restait `true` éternellement → tous les taps suivants étaient ignorés.

---

## 2. Cause exacte du blocage au 3e clic

Le 3e clic est le point où la désynchronisation devient visible:

- Tap 1: `stroopResults = []` → `next = [r1]` → `setStroopIndex(1)` ✅
- Tap 2: `stroopResults` encore `[]` (stale) → `next = [r1]` (pas `[r1, r2]`) → `setStroopIndex(1)` (devrait être 2) ❌
- Tap 3: `stroopResults = [r1]` (re-render finally happened) → `next = [r1, r3]` → `setStroopIndex(2)` → mais l'UI montre l'essai 3 alors que seulement 2 résultats sont enregistrés
- L'utilisateur voit que l'essai ne avance pas correctement → impression de freeze

Le `setTimeout(150ms)` pour `stroopAdvancingRef` aggravait le problème: pendant 150ms après chaque tap, les taps suivants étaient ignorés. Si l'utilisateur tapait vite (mobile), le 3e tap tombait dans la fenêtre de lock et était ignoré.

---

## 3. Correction Stroop

### 3A. Ref-based results (élimine le stale closure)

```ts
// AVANT:
const [stroopResults, setStroopResults] = useState<StroopTrialResult[]>([]);
// ...
const next = [...stroopResults, result];  // ← stale!

// APRÈS:
const [, setStroopResults] = useState<StroopTrialResult[]>([]);
const stroopResultsRef = useRef<StroopTrialResult[]>([]);
// ...
const next = [...stroopResultsRef.current, result];  // ← always fresh
stroopResultsRef.current = next;
setStroopResults(next);  // ← trigger re-render only
```

### 3B. try/finally (élimine le setTimeout guard)

```ts
// AVANT:
stroopAdvancingRef.current = true;
// ... handler logic ...
window.setTimeout(() => { stroopAdvancingRef.current = false; }, 150);

// APRÈS:
stroopAdvancingRef.current = true;
try {
  // ... handler logic ...
} finally {
  stroopAdvancingRef.current = false;  // ← guaranteed reset, no timer
}
```

### 3C. Removed `stroopResults` from deps array

```ts
// AVANT:
}, [phase, stroopIndex, stroopTrials, stroopResults]);

// APRÈS:
}, [stroopPracticeMode, phase, stroopIndex, stroopTrials]);
```

### 3D. DEV instrumentation logs

```ts
if (import.meta.env?.DEV) {
  console.log(JSON.stringify({
    event: 'dg_stroop_tap',
    trialIndex: stroopIndex,
    selectedColor: color,
    expectedColor: trial.displayColor,
    isPractice: false,
    accepted: true,
    behaviorInteractionsBefore: getTouchBehaviorCollector().getInteractionCount()
  }));
}
```

---

## 4. Vérification N-Back/Digit/Trail

### N-Back — même fix appliqué

- `nbackResultsRef` ajouté (remplace `nbackResults` state dans le handler)
- `try/finally` remplace `setTimeout(150ms)`
- `nbackResults` retiré des deps
- DEV log ajouté (`dg_nback_tap`)

### Digit Span — pas de freeze

- `handleDigitSpanSubmit` n'utilise pas de `setTimeout` pour avancer
- Boutons 0-9: pas de `disabled`
- Bouton Valider: `disabled` seulement si input vide
- Avance immédiate: `setDigitSpanIndex(i+1)` + `setDigitSpanShowDigits(true)`

### Trail Tap — pas de freeze

- `handleTrailTap` n'utilise pas de `setTimeout`
- Tap incorrect: enregistre + continue (ne bloque pas)
- Tap correct: avance au prochain point immédiatement
- Dernier point: `setPhase('voice-proof')` immédiat

---

## 5. Behavior interaction result

Tous les taps (practice + scored) incrémentent `behaviorInteractions`:

| Module | Handler | Recorder | Compté |
|--------|---------|----------|--------|
| Réflexe | `handleCogReflexTap` | `recordReflexTap()` | ✅ |
| Couleurs practice | `handleStroopPracticeSelect` | `recordStroopSelection()` | ✅ |
| Couleurs scored | `handleStroopSelect` | `recordStroopSelection()` | ✅ |
| Mémoire | buttons + `handleDigitSpanSubmit` | `recordDigitSpanKey()` + `recordDigitSpanSubmit()` | ✅ |
| Comparaison practice | `handleNBackPracticeResponse` | `recordNBackDecision()` | ✅ |
| Comparaison scored | `handleNBackResponse` | `recordNBackDecision()` | ✅ |
| Chemin | `handleTrailTap` | `recordTrailTap()` | ✅ |

Test vérifié: 6 interactions pour 5 modules → `totalInteractions = 6`, `tasksObserved = 5`.

---

## 6. Cause exacte Redis WRONGTYPE

### Le log d'erreur

```
[BRAIN][PROCESSOR] Redis cache update failed: Command 1 [ hset ] failed:
WRONGTYPE Operation against a key holding the wrong kind of value
```

### Root cause: collision de clé Redis

**Deux systèmes écrivent sur la même clé `brain:state` avec des types différents:**

| Source | Clé | Type Redis | Commande | Usage |
|--------|-----|------------|----------|-------|
| `hcs-u7-admin/lib/brain-processor.ts` | `brain:state` | HASH | `HSET` | Cache threat level + metrics |
| `hcs-u7-admin/app/api/admin/brain/mode/route.ts` | `brain:state` | STRING | `SET` | Brain mode (OBSERVATION/SEMI_AUTO/FULL_AUTONOMY) |
| `hcs-u7-backend/src/routes/admin/brain-mode.ts` | `brain:state` | STRING | `SET` | Brain mode (même usage) |
| `hcs-u7-backend/src/brain/v2/control-loop.ts` | `brain:state` | STRING | `fetch(/set/brain:state/...)` | Brain state push |

**Scénario de l'erreur:**
1. Backend ou admin mode route écrit `brain:state` = `"OBSERVATION"` (STRING)
2. Cron Brain processor tourne → `HSET brain:state { threat_level: ... }` → **WRONGTYPE** car la clé est un STRING, pas un HASH
3. Le cache n'est pas mis à jour → l'admin dashboard ne voit pas les nouvelles métriques
4. L'erreur se répète toutes les 5 minutes (intervalle cron)

---

## 7. Correction Redis

### 7A. Clé versionnée: `brain:state:v2`

**Admin (`lib/brain-processor.ts`):**
```ts
// AVANT:
const BRAIN_STATE_KEY = "brain:state";

// APRÈS:
const BRAIN_STATE_KEY = "brain:state:v2";
```

**Lecteurs mis à jour (admin):**
- `app/api/admin/brain/status/route.ts` → `hgetall("brain:state:v2")`
- `app/api/admin/brain/health/route.ts` → `hgetall("brain:state:v2")`
- `app/api/admin/brain/context/route.ts` → `hgetall("brain:state:v2")`
- `lib/fetchRealRedisContext.ts` → `redisHGetAll("brain:state:v2")`

**Backend (`src/routes/admin/brain-stream.ts`):**
```ts
// AVANT:
const BRAIN_STATE_KEY = 'brain:state';

// APRÈS:
const BRAIN_STATE_KEY = 'brain:state:v2';
```

### 7B. Type guard avant HSET

```ts
// Avant le HSET, vérifier le type de la clé:
const existingType = await redis.type(BRAIN_STATE_KEY);
if (existingType && existingType !== 'hash' && existingType !== 'none') {
  console.log(JSON.stringify({
    event: 'brain_redis_cache_wrongtype',
    keySafe: BRAIN_STATE_KEY,
    expectedType: 'hash',
    actualType: existingType,
    action: 'deleting_and_recreating',
  }));
  await redis.del(BRAIN_STATE_KEY);
}
```

### 7C. Séparation des deux usages

| Clé | Type | Usage | Écrivains |
|-----|------|-------|-----------|
| `brain:state` | STRING | Brain mode (OBSERVATION/SEMI_AUTO/FULL_AUTONOMY) | mode route, backend brain-mode, control-loop |
| `brain:state:v2` | HASH | Cache threat level + metrics | brain-processor (cron) |

### 7D. Non modifié (intentionnel)

- `brain:state` (STRING) reste utilisé par mode route, backend brain-mode, control-loop, sovereign-agent, claude route, local-llm route — ce sont des lectures/écritures STRING, pas de collision avec le HASH.
- `brain:meta` reste un HASH — pas de collision connue.
- `brain:events` reste une LIST — pas de collision connue.

---

## 8. Preuve que les deux problèmes sont séparés

| Critère | Freeze mobile | Redis WRONGTYPE |
|---------|---------------|-----------------|
| **Repos** | payguard (frontend) | hcs-u7-admin + hcs-u7-backend |
| **Timing** | Pendant interaction utilisateur | Toutes les 5 minutes (cron) |
| **Impact** | Bloque le test Couleurs | Cache Brain non mis à jour |
| **Cause** | Stale closure + setTimeout guard | Collision de clé Redis (STRING vs HASH) |
| **Fix** | Ref-based results + try/finally | Clé versionnée brain:state:v2 |
| **Code** | `DemoGuard.tsx` | `brain-processor.ts` + routes admin |

**Conclusion: les deux problèmes sont totalement indépendants.** Le freeze mobile est un bug React state management dans payguard. Le Redis WRONGTYPE est un bug de collision de clé entre admin et backend. Aucun lien causal.

---

## 9. Tests results

### payguard — tests

| Fichier | Tests | Résultat |
|---------|-------|----------|
| `demoguard-runtime-deep-01-stroop-freeze.test.ts` | 28 | ✅ All passed |
| `demoguard-ux04-dead-click-fix.test.ts` | 31 | ✅ All passed |
| `demoguard-ux03-touch-guard-fix.test.ts` | 27 | ✅ All passed |
| `demoguard-ux02-rebuild.test.ts` | 36 | ✅ All passed |
| `p10-behavior-integrated-touch.test.ts` | 19 | ✅ All passed |
| **Total** | **141** | **✅ All passed** |

### hcs-u7-admin — tests

| Fichier | Tests | Résultat |
|---------|-------|----------|
| `brain-redis-wrongtype-audit.test.ts` | 15 | ✅ All passed |

### payguard — tsc + build

```
npx tsc --noEmit — exit 0 ✅
npm run build — exit 0 ✅
  dist/assets/index-AazeYqX2.js   193.53 kB │ gzip: 63.15 kB
```

### hcs-u7-admin — tsc

```
npx tsc --noEmit — 7 errors (pre-existing in tests/p10-behavior-propagation.test.ts, not related to our changes)
```

Les 7 erreurs TypeScript dans `tests/p10-behavior-propagation.test.ts` sont pré-existantes et non liées à nos modifications (type narrowing issues sur `behaviorSummary.quality`).

---

## 10. GO / NO-GO test réel téléphone

### ✅ GO

**Justification freeze mobile:**
- Stale closure éliminé: `stroopResultsRef.current` remplace `stroopResults` state dans le handler
- `setTimeout(150ms)` guard remplacé par `try/finally` — reset garanti même en cas d'exception
- `stroopResults` retiré du deps array — le handler ne dépend plus de l'état React pour les résultats
- N-Back: même fix appliqué
- Digit Span et Trail Tap: pas de freeze (pas de setTimeout, pas de stale closure)
- 28 tests de freeze passent, 141 tests total passent

**Justification Redis:**
- Clé versionnée `brain:state:v2` (HASH) séparée de `brain:state` (STRING)
- Type guard ajouté avant HSET
- Tous les lecteurs admin mis à jour
- Backend brain-stream.ts mis à jour
- 15 tests Redis passent

**Test réel à vérifier sur téléphone:**
1. Test 2 Couleurs — taper 6 couleurs rapidement sans pause → doit avancer jusqu'à "Test 3 — Mémoire courte"
2. Vérifier que le 3e tap avance bien (c'était le point de freeze)
3. Double tap rapide sur une couleur → un seul résultat enregistré
4. Test 4 Comparaison — taper OUI/NON rapidement → doit avancer jusqu'à "Test 5 — Chemin"
5. Vérifier logs Vercel admin: plus de `[BRAIN][PROCESSOR] Redis cache update failed: WRONGTYPE`
6. Vérifier admin dashboard: Brain status affiche les métriques (threat level, events, abuse rate)

**Test réel à vérifier sur admin:**
1. Après déploiement, le cron Brain devrait écrire sur `brain:state:v2` sans erreur
2. L'admin dashboard devrait lire `brain:state:v2` et afficher les métriques
3. Le mode route continue à utiliser `brain:state` (STRING) sans interférence
