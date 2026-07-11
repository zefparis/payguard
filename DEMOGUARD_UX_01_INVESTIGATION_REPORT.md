# DEMOGUARD_UX_01_INVESTIGATION_REPORT.md
## DEMOGUARD-UX-01 — Full Mobile UX Investigation

**Date:** 2026-07-11  
**Author:** Cascade (IA SOLUTION)  
**Status:** Investigation complete — GO for DEMOGUARD-UX-02  
**Repo:** payguard  
**Patents Pending FR2514274 | FR2514546**

---

## 1. Flow actuel

### Phase sequence (18 phases)

```
idle → device → permissions → camera → reaction → voice
  → cognitive-intro (reflex) → cognitive-stroop → cognitive-digit-span
  → cognitive-nback → cognitive-trail-tap → cognitive-vocal-ran
  → cognitive-summary → device-signals → readiness → submitting → done
```

### Carte détaillée par étape

| # | Phase | Ce que l'utilisateur voit | Ce qu'il doit faire | Ce qui est collecté | Confusion possible | Mauvais signal possible |
|---|-------|--------------------------|---------------------|---------------------|---------------------|-------------------------|
| 1 | `idle` | Input "HCS Session Public ID" + bouton "Start DemoGuard Check" | Entrer un session ID et cliquer | Rien | L'utilisateur ne sait pas ce qui va se passer. Pas d'explication du processus. | — |
| 2 | `device` | Carte "Device Check" (platform, screen, online, timezone) | Attendre | Device context | Auto, pas d'action requise | — |
| 3 | `permissions` | Carte "Permissions" (camera, microphone) | Autoriser caméra + micro | Permission status | Pas d'explication de pourquoi on demande ces permissions | — |
| 4 | `camera` | Vidéo live + boutons "Capture" / "Skip" | Prendre un selfie ou skipper | Selfie signal + selfie_b64 | L'utilisateur ne comprend pas pourquoi un selfie. "Skip" est trop visible. | Si skip → selfie missing |
| 5 | `reaction` | Bouton coloré "TAP TO START" → "WAIT..." → "TAP NOW!" | Taper quand le bouton devient vert | Reaction time, too_fast, too_slow | Instructions minimales. "TAP TO START" puis "WAIT..." puis "TAP NOW" — la séquence n'est pas expliquée. | Trop tôt = too_fast. Pas de feedback sur ce qui se passe. |
| 6 | `voice` | Phrase technique + bouton "Record" / "Skip" | Lire la phrase à voix haute | Voice signal + voice_b64 + MFCC | **Phrase technique incompréhensible** (voir §3). Pas de countdown. Pas de barre de niveau. Pas de feedback "Voix capturée". | Si l'utilisateur hésite ou lit mal → audio quality low → voice status REVIEW |
| 7 | `cognitive-intro` (reflex) | Bouton "TAP TO START" → "WAIT..." → "TAP NOW!" | Taper quand vert | Reflex signal | Même test que l'étape 5, répété. L'utilisateur ne comprend pas pourquoi il refait le même test. | Identique à l'étape 5 |
| 8 | `cognitive-stroop` | Mot coloré + 4 boutons de couleurs | Sélectionner la COULEUR du mot (pas le mot lui-même) | Stroop signal | "Select the COLOR shown" — pas d'exemple. La consigne Stroop est contre-intuitive par nature. | Si l'utilisateur lit le mot au lieu de la couleur → accuracy 0 → quality failed |
| 9 | `cognitive-digit-span` | Séquence de chiffres affichée 3s → input | Mémoriser et retaper la séquence | Digit span signal | Les chiffres s'affichent seulement 3 secondes. Pas de "Ready?" avant l'affichage. Input clavier sur mobile. | Si l'utilisateur n'a pas vu l'affichage → accuracy 0 |
| 10 | `cognitive-nback` | Lettre + boutons "MATCH" / "NO" | Dire si la lettre = lettre précédente | N-Back signal | **Incompréhensible** (voir §2). Pas d'exemple, pas d'entraînement. | Si l'utilisateur ne comprend pas → réponses aléatoires → accuracy < 0.4 → quality failed |
| 11 | `cognitive-trail-tap` | 5 boutons numérotés positionnés aléatoirement | Taper dans l'ordre 1→2→3→4→5 | Trail tap signal | Instructions claires ("Tap dots in order 1 → 5"). OK. | — |
| 12 | `cognitive-vocal-ran` | 5 chiffres affichés + bouton "Record" / "Skip" | Lire les chiffres à voix haute | Vocal RAN signal + **DEUXIÈME capture vocale** | **Deuxième prise vocale !** (voir §4). L'utilisateur vient de faire une prise vocale à l'étape 6. Pourquoi encore ? | Si l'utilisateur skip → vocal_ran quality failed. Deuxième audio écrase le premier dans sensitiveRef. |
| 13 | `cognitive-summary` | Résumé: modules, depth, consistency, anomaly, human likelihood | Cliquer "Continue to device signals" | Cognitive summary | Affiche des métriques techniques. "Human likelihood: low" peut inquiéter. | — |
| 14 | `device-signals` | Auto (3s) | Attendre | Motion, orientation, touch, visibility, network | Auto, pas d'action. L'utilisateur attend sans comprendre. | Touch collecté ici est passif (3s), pas lié au behavior collector |
| 15 | `readiness` | Toutes les cartes + warnings + bouton "Submit" | Vérifier et submit | Quality score | Beaucoup d'informations techniques affichées. Warnings techniques. | — |
| 16 | `submitting` | Spinner | Attendre | — | — | — |
| 17 | `done` | Résultat + decision | Lire le résultat | Response | "HCS cognitive result not finalized — Hybrid Vector used safe REVIEW fallback" = jargon technique | — |

---

## 2. Audit N-Back

### État actuel

**Fichier:** `src/demoguard/cognitive/nBackChallenge.ts` + `DemoGuard.tsx:1271-1285`

**UI affichée:**
```
Cognitive Battery — N-Back (1-back)
Trial 1 / 8 — Same as previous?
   A
[MATCH]  [NO]
[Skip N-Back]
```

### Problèmes identifiés

| # | Problème | Sévérité |
|---|----------|----------|
| 1 | **Aucune explication** de ce qu'est un N-Back | 🔴 Critique |
| 2 | **Aucun exemple** — l'utilisateur ne sait pas ce que "same as previous" veut dire | 🔴 Critique |
| 3 | **Aucun essai d'entraînement** — le premier trial compte immédiatement | 🔴 Critique |
| 4 | **Boutons "MATCH" / "NO"** — "MATCH" en anglais, pas de traduction, pas assez visible | 🟡 Moyen |
| 5 | **Pas de feedback** après chaque tap — l'utilisateur ne sait pas s'il a eu bon | 🟡 Moyen |
| 6 | **"Same as previous?"** — la question est vague. "Previous" = le trial immédiatement avant ? | 🟡 Moyen |
| 7 | **8 trials d'un coup** — pas de progression visible (juste "Trial 1/8") | 🟢 Mineur |
| 8 | **Pas de compteur de score** pendant le test | 🟢 Mineur |

### Impact sur les signaux

- L'utilisateur ne comprend pas → réponses aléatoires → accuracy < 0.4 → `quality: 'failed'`
- False positives ≥ 3 → `quality: 'review'`
- Anomalie score += 0.1 si false_positives ≥ 3
- Cognitive depth réduite si module failed

### Proposition de version claire

**Instructions:**
```
Mémoire courte

Tu vas voir une suite de lettres.
Appuie sur OUI si la lettre actuelle est la même que la précédente.
Sinon appuie sur NON.

Exemple: A → B → B → C → C
                     ↑           ← OUI (B = B)
                           ↑     ← NON (C ≠ B)
```

**Ajouter:**
- 3 essais d'entraînement non scorés avec feedback "Correct!" / "Oups!"
- Compteur "Essai 1/8" (déjà présent)
- Boutons très visibles: **OUI** (vert, grand) / **NON** (gris, grand)
- Feedback après chaque tap: "✓ Correct" ou "✗ La lettre était différente"
- Ne pas pénaliser l'apprentissage initial (3 premiers trials = entraînement)

---

## 3. Audit Vocal

### État actuel

**Fichier:** `src/demoguard/collectors/audioCollector.ts:40-43`

**Phrase générée:**
```typescript
export function generateChallengePhrase(challengeId: string): string {
  const code = challengeId.replace('dg_voice_', '');
  return `Code HCS ${code} — validation mobile`;
}
```

**Exemple de phrase affichée:** `"Code HCS AB3X9Z — validation mobile"`

### Problèmes identifiés

| # | Problème | Sévérité |
|---|----------|----------|
| 1 | **"Code HCS"** — jargon technique, l'utilisateur ne sait pas ce qu'est HCS | 🔴 Critique |
| 2 | **Code aléatoire** — l'utilisateur doit lire un code absurde, peu naturel | 🟡 Moyen |
| 3 | **"validation mobile"** — terme technique, pas naturel à dire à voix haute | 🟡 Moyen |
| 4 | **Pas de countdown** avant l'enregistrement | 🟡 Moyen |
| 5 | **Pas de barre de niveau micro** | 🟡 Moyen |
| 6 | **Pas de feedback "Voix capturée"** après l'enregistrement | 🟡 Moyen |
| 7 | **Pas de possibilité de reprendre** | 🟡 Moyen |
| 8 | **Durée fixe 4s** — pas indiquée à l'utilisateur | 🟢 Mineur |
| 9 | **Bouton "Skip"** trop visible — l'utilisateur peut skipper sans comprendre l'impact | 🟡 Moyen |

### Phrase vocale recommandée

**Option principale:**
> "Je confirme que je suis bien présent et que je réalise ce contrôle maintenant."

**Option courte:**
> "Je suis présent et je valide ce contrôle."

### UX recommandée

```
Contrôle vocal

Parle normalement, dans un endroit calme.

[3]  [2]  [1]  🔴 ENREGISTREMENT...

"Je confirme que je suis bien présent
 et que je réalise ce contrôle maintenant."

████████░░░░  Niveau micro

✓ Voix capturée (3.2s)

[Reprendre]  [Continuer]
```

---

## 4. Double voice capture — CONFIRMÉE

### Architecture vocale actuelle

**Il y a DEUX captures vocales distinctes dans le flow:**

| # | Phase | Fonction | Durée | Challenge ID | Ce qui est capturé |
|---|-------|----------|-------|-------------|-------------------|
| A | `voice` (étape 6) | `recordVoiceChallenge(4000, voiceChallengeId)` | 4s | `dg_voice_XXXXXX` | voice_b64 + mfcc_summary → `sensitiveRef.current[VOICE_KEY]` |
| B | `cognitive-vocal-ran` (étape 12) | `recordVoiceChallenge(5000, vocalRanChallenge.challenge_id)` | 5s | `dg_vran_XXXXXX` | voice_b64 + mfcc_summary → **écrase** `sensitiveRef.current[VOICE_KEY]` |

### Code path — capture A (voice phase)

```typescript
// DemoGuard.tsx:442-460
const handleRecordVoice = useCallback(async () => {
  const result = await recordVoiceChallenge(4000, voiceChallengeId);
  setVoiceSignal(result.safe);
  setVoiceDiagnostic(result.diagnostic);
  if (result.sensitive) {
    Object.assign(sensitiveRef.current, result.sensitive);  // ← écrit voice_b64
  }
  setPhase('cognitive-intro');
}, [voiceChallengeId]);
```

### Code path — capture B (vocal RAN phase)

```typescript
// DemoGuard.tsx:688-710
const handleVocalRanRecord = useCallback(async () => {
  const result = await recordVoiceChallenge(5000, vocalRanChallenge.challenge_id);
  // ...
  if (result.sensitive) {
    Object.assign(sensitiveRef.current, result.sensitive);  // ← ÉCRASE voice_b64 !
  }
  finishCognitiveBattery();
}, [vocalRanChallenge]);
```

### Confirmation: la capture B écrase la capture A

Les deux utilisent `Object.assign(sensitiveRef.current, result.sensitive)` avec la même clé `voice_b64`. La deuxième capture **écrase** la première.

### Ce que HCS reçoit

HCS reçoit le **dernier** audio (capture B = vocal RAN), pas le premier (capture A = voice challenge). Le `voiceSignal` et `voiceDiagnostic` affichés dans l'UI correspondent à la capture A, mais l'audio envoyé est celui de la capture B.

### Inconséquence

- `voiceSignal.recorded = true` (capture A)
- `voiceDiagnostic.audioCaptured = true` (capture A)
- Mais `sensitiveRef.current.voice_b64` = capture B (écrasée)
- Si l'utilisateur skippe le vocal RAN → `sensitiveRef.current.voice_b64` = capture A (préservée)
- Si l'utilisateur fait le vocal RAN → `sensitiveRef.current.voice_b64` = capture B (capture A perdue)

### Recommandation

**Supprimer la double prise. Garder une seule Voice Proof claire.**

Option A (recommandée): **Fusionner** — le Vocal RAN devient la seule prise vocale
- Le user lit les chiffres + la phrase simple
- Une seule capture de 5s
- `voiceSignal` et `voiceDiagnostic` alimentés par cette capture
- Supprimer la phase `voice` séparée

Option B: **Supprimer le Vocal RAN** — garder seulement la Voice Proof
- La phase `voice` devient la seule capture
- Le Vocal RAN est retiré du flow
- Le module `vocal_ran` dans le cognitive summary devient `null`

Option C: **Vocal RAN sans capture audio** — juste le timing
- Le Vocal RAN affiche les chiffres et mesure le temps
- Pas d'enregistrement audio (juste `audio_present: false` si pas de capture)
- La Voice Proof reste la seule capture audio

**Recommandation: Option B** — supprimer le Vocal RAN du flow par défaut, garder la Voice Proof comme seule capture. Le Vocal RAN peut être déplacé en mode avancé si nécessaire.

---

## 5. Audit behavior touch

### Architecture actuelle

Deux systèmes de collecte touch **indépendants**:

| Système | Quand | Durée | Ce qu'il collecte | Où c'est stocké |
|---------|-------|-------|-------------------|-----------------|
| `collectTouch(3000)` | Phase `device-signals` | 3s | Touch count, touch start count, pointer touch count | `touchSignal` (DemoGuardTouchSignal) |
| `TouchBehaviorCollector` singleton | Pendant les modules cognitifs | Tous les modules | Interactions par tâche, pressure, corrections, wrong taps, rhythm | `behaviorSummary` (BehaviorSummary) |

### Problèmes identifiés

| # | Problème | Sévérité | Impact |
|---|----------|----------|--------|
| 1 | **`collectTouch(3000)` est passif** — attend 3s sans interaction utilisateur | 🟡 Moyen | `touchSignal.touch_count` peut être 0 si l'utilisateur ne touche pas l'écran pendant ces 3s |
| 2 | **Le behavior collector ne capte que les interactions instrumentées** — si un module n'appelle pas `recordInteraction`, pas d'interaction enregistrée | 🟡 Moyen | Tous les modules semblent instrumentés, mais le Digit Span utilise un input clavier |
| 3 | **Digit Span input clavier** — sur mobile, l'input ouvre le clavier virtuel. Les taps sur le clavier ne sont pas des touch events sur des boutons | 🟡 Moyen | `recordDigitSpanKey` et `recordDigitSpanSubmit` sont appelés, donc les interactions sont enregistrées, mais pas de touch physique sur des boutons |
| 4 | **Pas de warning si behavior interactions = 0** | 🔴 Critique | L'utilisateur peut submit avec 0 interactions behavior sans warning |
| 5 | **Le snapshot behavior est pris à la fin** dans `finishCognitiveBattery` | 🟢 Mineur | Si les modules sont skipés, le behavior est vide |
| 6 | **`touchSignal` et `behaviorSummary` sont confondants** — deux systèmes différents pour des choses similaires | 🟡 Moyen | L'UI affiche les deux, l'utilisateur ne comprend pas la différence |

### Vérification: tous les modules instrumentent-ils le behavior collector ?

| Module | `recordTaskStart` | `recordInteraction` | OK ? |
|--------|-------------------|---------------------|------|
| Reflex | ✅ `handleCogReflexTap` quand `cogReflexPhase === 'ready'` | ✅ `recordReflexTap` | ✅ |
| Stroop | ✅ `handleStroopSelect` quand `stroopIndex === 0` | ✅ `recordStroopSelection` | ✅ |
| Digit Span | ✅ `handleDigitSpanSubmit` quand `digitSpanIndex === 0` | ✅ `recordDigitSpanKey` + `recordDigitSpanSubmit` | ✅ |
| N-Back | ✅ `handleNBackResponse` quand `nbackIndex === 0` | ✅ `recordNBackDecision` | ✅ |
| Trail Tap | ✅ `handleTrailTap` quand `trailStartRef.current === 0` | ✅ `recordTrailTap` | ✅ |
| Vocal RAN | ✅ `handleVocalRanRecord` | ✅ `recordVocalRanInteraction` | ✅ |

**Tous les modules sont instrumentés.** Le problème n'est pas l'instrumentation mais:
1. Si l'utilisateur skippe des modules → pas d'interactions pour ces modules
2. Le `collectTouch(3000)` passif ne contribue pas au behavior collector
3. Pas de warning si behavior est vide

### Recommandations

1. **Ajouter un warning** si `behaviorSummary.totalInteractions === 0` et `touchSupported === true`:
   > "⚠️ Signature tactile manquante — complète les tests pour générer une signature tactile"

2. **Bloquer le submit** (ou afficher warning visible) si `behavior interactions = 0` et `touch supported`

3. **Afficher un compteur d'interactions** en petit pendant les tests:
   > "Interactions détectées: 12"

4. **Rendre le Digit Span plus tactile** — au lieu d'un input clavier, utiliser des boutons de chiffres (0-9) que l'utilisateur tape

---

## 6. Audit par module cognitif

### Réflex (phase: `reaction` + `cognitive-intro`)

| Critère | Évaluation |
|---------|------------|
| Compréhensible en < 5s ? | ⚠️ Partiellement — "TAP TO START" puis "WAIT..." puis "TAP NOW!" n'est pas expliqué |
| Faisable sur téléphone ? | ✅ Oui — un seul gros bouton |
| Signaux utiles ? | ✅ Oui — reaction time, too_fast, too_slow, regularity |
| Assez d'interactions ? | ✅ Oui — 3 rounds (COG_REFLEX_ROUNDS) |
| Instruction simple ? | ⚠️ Manque d'instruction: "Quand le bouton devient vert, tape le plus vite possible" |
| Exemple ? | ❌ Non |
| Feedback ? | ⚠️ "Last: 423 ms" — OK mais pas de comparaison (bon/mauvais) |
| Raccourcissable ? | ⚠️ Fait 2x (reaction + cognitive-intro) — redondant |

**Verdict: simplify** — Fusionner les deux tests de réflexe en un seul. Ajouter une instruction claire.

### Stroop (phase: `cognitive-stroop`)

| Critère | Évaluation |
|---------|------------|
| Compréhensible en < 5s ? | ❌ Non — "Select the COLOR shown" est contre-intuitif |
| Faisable sur téléphone ? | ✅ Oui — 4 boutons de couleurs |
| Signaux utiles ? | ✅ Oui — accuracy, response time, interference effect |
| Assez d'interactions ? | ✅ Oui — 6 trials |
| Instruction simple ? | ❌ Manque d'exemple visuel |
| Exemple ? | ❌ Non |
| Feedback ? | ❌ Non |
| Raccourcissable ? | ✅ 6 trials est OK |

**Verdict: simplify** — Ajouter un exemple: "Le mot 'ROUGE' affiché en BLEU → appuie sur BLEU". Ajouter du feedback.

### Digit Span (phase: `cognitive-digit-span`)

| Critère | Évaluation |
|---------|------------|
| Compréhensible en < 5s ? | ⚠️ Partiellement — "Type the sequence" après affichage de 3s |
| Faisable sur téléphone ? | ⚠️ Input clavier sur mobile — pas idéal pour le touch behavior |
| Signaux utiles ? | ✅ Oui — memory span, accuracy |
| Assez d'interactions ? | ⚠️ Limité — 3 trials, 1 submit par trial = 3 interactions behavior |
| Instruction simple ? | ⚠️ "Trial 1/3 — 4 digits" — pas d'instruction "Mémorise ces chiffres" |
| Exemple ? | ❌ Non |
| Feedback ? | ❌ Non |
| Raccourcissable ? | ✅ 3 trials est OK |

**Verdict: simplify** — Ajouter "Mémorise ces chiffres, tu devras les retaper". Remplacer l'input clavier par des boutons de chiffres (0-9). Ajouter un "Ready?" avant l'affichage.

### N-Back (phase: `cognitive-nback`)

| Critère | Évaluation |
|---------|------------|
| Compréhensible en < 5s ? | ❌ Non — incompréhensible sans explication |
| Faisable sur téléphone ? | ✅ Oui — 2 boutons |
| Signaux utiles ? | ✅ Oui — working memory, accuracy, false positives |
| Assez d'interactions ? | ✅ Oui — 8 trials |
| Instruction simple ? | ❌ Non — "Same as previous?" est insuffisant |
| Exemple ? | ❌ Non |
| Feedback ? | ❌ Non |
| Raccourcissable ? | ✅ 8 trials est OK |

**Verdict: simplify** — Priorité #1. Voir §2 pour la proposition détaillée.

### Trail Tap (phase: `cognitive-trail-tap`)

| Critère | Évaluation |
|---------|------------|
| Compréhensible en < 5s ? | ✅ Oui — "Tap dots in order 1 → 5" |
| Faisable sur téléphone ? | ✅ Oui — boutons positionnés |
| Signaux utiles ? | ✅ Oui — path efficiency, completion time, accuracy |
| Assez d'interactions ? | ✅ Oui — 5 taps minimum |
| Instruction simple ? | ✅ Oui |
| Exemple ? | ❌ Non mais la consigne est claire |
| Feedback ? | ⚠️ Le bouton change de couleur ? Non visible dans le code |
| Raccourcissable ? | ✅ 5 nodes est OK |

**Verdict: keep** — Le module le plus clair. Ajouter du feedback visuel (bouton grisé après tap correct).

### Vocal RAN (phase: `cognitive-vocal-ran`)

| Critère | Évaluation |
|---------|------------|
| Compréhensible en < 5s ? | ✅ Oui — "Read these numbers aloud, in order" |
| Faisable sur téléphone ? | ✅ Oui |
| Signaux utiles ? | ⚠️ Partiellement — duration et audio_present, mais l'audio écrase la voice capture |
| Assez d'interactions ? | ⚠️ 1 seule interaction (`recordVocalRanInteraction`) |
| Instruction simple ? | ✅ Oui |
| Exemple ? | ❌ Non mais la consigne est claire |
| Feedback ? | ❌ Non |
| Raccourcissable ? | ✅ 5 items est OK |

**Verdict: remove from default flow** — La double capture est le problème principal. Supprimer du flow par défaut.

### Résumé

| Module | Verdict | Priorité |
|--------|---------|----------|
| Reflex (x2) | **simplify** — fusionner en un seul | 🟡 |
| Stroop | **simplify** — ajouter exemple + feedback | 🟡 |
| Digit Span | **simplify** — boutons tactiles + instruction | 🟡 |
| N-Back | **simplify** — explication + entraînement | 🔴 #1 |
| Trail Tap | **keep** — OK, ajouter feedback | 🟢 |
| Vocal RAN | **remove from default flow** — double capture | 🔴 #2 |

---

## 7. Nouveau flow UX proposé

```
1. Welcome
   "Ce contrôle vérifie une présence humaine réelle en quelques étapes.
    Ça prend environ 2 minutes."

2. Permissions
   "Autorise la caméra et le micro pour le contrôle."
   [Autoriser caméra]  [Autoriser micro]

3. Selfie (optionnel, pas mis en avant)
   "Prends une photo de toi pour vérifier ta présence."
   [Capture]  [Passer]

4. Réflexe
   "Quand le bouton devient vert, tape le plus vite possible."
   Exemple: bouton rouge → bouton vert → tap
   3 rounds

5. Couleurs (Stroop)
   "Appuie sur la COULEUR du mot, pas sur le mot lui-même."
   Exemple: "ROUGE" en bleu → appuie sur BLEU
   6 trials

6. Mémoire (Digit Span)
   "Mémorise ces chiffres, tu devras les retaper."
   Affichage 3s → boutons 0-9
   3 trials

7. Mémoire courte (N-Back simplifié)
   "Appuie sur OUI si la lettre est la même que la précédente."
   Exemple + 3 essais d'entraînement
   8 trials

8. Trail Tap
   "Tape les points dans l'ordre 1 → 5"
   5 nodes

9. Contrôle vocal unique
   "Parle normalement, dans un endroit calme."
   Countdown 3-2-1
   "Je confirme que je suis bien présent et que je réalise ce contrôle maintenant."
   Barre de niveau micro
   ✓ Voix capturée
   [Reprendre]  [Continuer]

10. Résumé
    ✅ Cognition complète (5/5 modules)
    ✅ Signature tactile détectée (XX interactions)
    ✅ Voix capturée (3.2s)
    [Soumettre]

11. Résultat
    Approved / Review / Rejected
    "Ton profil cognitif correspond à une présence humaine réelle."
    Pas de jargon technique
```

### Changements clés vs flow actuel

| Changement | Raison |
|------------|--------|
| Ajouter étape Welcome | L'utilisateur sait ce qui l'attend |
| Fusionner les 2 tests réflexe en 1 | Redondance |
| Ajouter exemples à Stroop et N-Back | Compréhension |
| Remplacer input clavier Digit Span par boutons 0-9 | Plus tactile, mieux pour behavior |
| Ajouter 3 essais d'entraînement N-Back | Apprentissage sans pénalité |
| Supprimer Vocal RAN du flow par défaut | Éliminer la double capture |
| Voice Proof unique avec countdown + niveau + feedback | UX claire |
| Résumé simple en langage naturel | Pas de jargon |
| Résultat en langage simple | Compréhensible |

---

## 8. Wording recommandé

### Remplacements

| Actuel (jargon) | Recommandé (simple) |
|------------------|---------------------|
| "HCS-U7 DemoGuard" | "Contrôle de présence" |
| "Human Cognitive Signature" | "Signature humaine" |
| "Cognitive Battery — Reflex" | "Réflexe" |
| "Cognitive Battery — Stroop" | "Couleurs" |
| "Cognitive Battery — Digit Span" | "Mémoire" |
| "Cognitive Battery — N-Back (1-back)" | "Mémoire courte" |
| "Cognitive Battery — Trail Tap" | "Parcours" |
| "Cognitive Battery — Vocal RAN" | (supprimé du flow par défaut) |
| "Voice Challenge" | "Contrôle vocal" |
| "Code HCS XXXXXX — validation mobile" | "Je confirme que je suis bien présent et que je réalise ce contrôle maintenant." |
| "Select the COLOR shown" | "Appuie sur la COULEUR du mot, pas sur le mot lui-même" |
| "Same as previous?" | "La lettre actuelle est-elle la même que la précédente ?" |
| "MATCH" / "NO" | "OUI" / "NON" |
| "Type the sequence" | "Retape les chiffres que tu viens de voir" |
| "Behavioral Touch" | "Signature tactile" |
| "Cognitive depth" | "Profondeur cognitive" |
| "Human likelihood" | "Probabilité humaine" |
| "Anomaly" | "Anomalie" |
| "Hybrid Vector Decision" | "Décision" |
| "globalDecision: ACCEPT/REVIEW/REJECT" | "Accepté / En révision / Rejeté" |
| "HCS cognitive result not finalized" | "Résultat en cours d'analyse" |
| "voice_liveness_low_confidence" | (ne pas afficher — raison technique interne) |
| "behavior_touch_missing" | (ne pas afficher — raison technique interne) |

### Boutons

| Actuel | Recommandé |
|--------|------------|
| "Start DemoGuard Check" | "Commencer le contrôle" |
| "Skip" | "Passer" (plus petit, moins visible) |
| "Record" | "Démarrer l'enregistrement" |
| "Submit" | "Soumettre" |
| "Skip N-Back" | "Passer ce test" |
| "Continue to device signals" | "Continuer" |

---

## 9. Risques techniques

| # | Risque | Impact | Mitigation |
|---|--------|--------|------------|
| 1 | **Suppression Vocal RAN** change le cognitive summary (5 modules au lieu de 6) | Cognitive depth max réduit | Ajuster `computeCognitiveSummary` pour 5 modules au lieu de 6 |
| 2 | **Fusion des 2 réflexes** réduit le nombre de signaux | Moins de données pour le scoring | Le réflexe cognitif a les mêmes métriques que le réflexe simple |
| 3 | **Boutons 0-9 pour Digit Span** change le behavior | Plus d'interactions (positif) | Vérifier que `recordDigitSpanKey` est appelé sur chaque bouton |
| 4 | **Essais d'entraînement N-Back** doivent être non scorés | Si scorés par erreur → faux signaux | Marquer les 3 premiers trials comme `isTraining: true` |
| 5 | **Suppression de la phase `voice` séparée** change le payload | `voiceSignal` et `voiceDiagnostic` doivent être alimentés par la nouvelle capture unique | Fusionner les deux captures en une seule |
| 6 | **Changement de phrase vocale** peut affecter le vocal liveness HCS | HCS attend une phrase spécifique ? | Vérifier le contrat HCS — la phrase est probablement libre |
| 7 | **Compteur d'interactions visible** peut être manipulé par un bot | Un bot peut forcer des interactions | Le behavior collector mesure la qualité, pas seulement la quantité |

---

## 10. Corrections prioritaires

### P0 — Critique (bloque l'expérience utilisateur)

| # | Correction | Effort | Impact |
|---|------------|--------|--------|
| 1 | **Supprimer la double capture vocale** — fusionner Voice + Vocal RAN en une seule prise | Moyen | Élimine la confusion, fix le payload |
| 2 | **Réécrire la phrase vocale** — phrase simple et naturelle | Petit | L'utilisateur peut lire naturellement |
| 3 | **Ajouter explication + entraînement N-Back** | Moyen | L'utilisateur comprend le test |
| 4 | **Ajouter warning si behavior interactions = 0** | Petit | L'utilisateur sait qu'il manque des données |

### P1 — Important (améliore significativement l'UX)

| # | Correction | Effort | Impact |
|---|------------|--------|--------|
| 5 | **Ajouter étape Welcome** avec explication du processus | Petit | L'utilisateur sait ce qui l'attend |
| 6 | **Ajouter exemple Stroop** | Petit | L'utilisateur comprend la consigne |
| 7 | **Remplacer input clavier Digit Span par boutons 0-9** | Moyen | Plus tactile, meilleur behavior |
| 8 | **Ajouter countdown + niveau micro + feedback voix** | Moyen | UX vocale claire |
| 9 | **Fusionner les 2 tests réflexe** | Petit | Évite la redondance |
| 10 | **Simplifier le wording** (tous les textes) | Petit | Compréhension globale |

### P2 — Nice-to-have (polish)

| # | Correction | Effort | Impact |
|---|------------|--------|--------|
| 11 | **Ajouter feedback après chaque tap** (N-Back, Stroop) | Petit | L'utilisateur apprend |
| 12 | **Afficher compteur d'interactions** en debug safe | Petit | Transparence |
| 13 | **Rendre "Skip" moins visible** | Petit | Évite le skip par défaut |
| 14 | **Simplifier le résultat** en langage naturel | Petit | Pas de jargon |
| 15 | **Ajouter "Reprendre" pour la voix** | Petit | Permet de corriger |

---

## 11. GO / NO-GO pour DEMOGUARD-UX-02

### ✅ GO — DEMOGUARD-UX-02 peut procéder

**Conditions remplies:**
- Flow actuel entièrement cartographié (18 phases)
- N-Back audité — problème critique confirmé (pas d'explication)
- Double capture vocale confirmée — capture B écrase capture A
- Phrase vocale trop technique confirmée
- Behavior touch audité — instrumentation OK mais pas de warning si vide
- Tous les modules cognitifs évalués (keep/simplify/remove)
- Nouveau flow UX proposé
- Wording recommandé
- Risques techniques identifiés
- Corrections priorisées (P0/P1/P2)

### Scope recommandé pour DEMOGUARD-UX-02

1. **P0 corrections** (4 items) — doivent être faites en premier
2. **P1 corrections** (6 items) — amélioration significative
3. Tests: `npx tsc --noEmit` + `npm run build` après chaque correction
4. Pas de modification du backend, du globalDecision, du scoring

### Limites restantes

- Le contrat HCS pour la phrase vocale doit être vérifié (peut-il être libre ?)
- Le `computeCognitiveSummary` doit être ajusté si le nombre de modules change
- Le `collectTouch(3000)` passif reste séparé du behavior collector

---

**Copyright (c) 2026 Benjamin BARRERE / IA SOLUTION**  
**Patents Pending FR2514274 | FR2514546**
