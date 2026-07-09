# DG-1: PayGuard Mobile Signal Audit Report

**Date:** 2026-03-24  
**Auditor:** Cascade (IA SOLUTION)  
**Scope:** PayGuard repo (`payguard/`), read-only on `hybrid-vector-api` backend  
**Objective:** Identify which mobile signals are really collected, simulated, missing, and reusable for DemoGuard

---

## 1. Résumé exécutif

PayGuard collecte **3 signaux réels** (selfie, temps de réaction, capture audio/MFCC) sur les 10+ signaux mobiles attendus. Trois composants cognitifs supplémentaires (Stroop, Digit Span, Voice) existent dans le code mais **ne sont pas câblés** dans les flux Enroll/Pay. Les signaux de motion, orientation, touch dynamics, visibility, Network Information API et Permissions API sont **totalement absents**.

**Sécurité client-side : CONFORME.** Aucune clé API, aucun sessionToken, aucun hcsCode, aucun JWT dans le code client. Le proxy Vercel injecte `HV_API_KEY` côté serveur uniquement. Le `tenant_id` est surchargé par `PAYGUARD_TENANT_ID` côté serveur.

**Risque principal côté backend :** Le backend `hybrid-vector-api/src/routes/payguard.ts` logge `first_name`, `last_name`, `student_id` dans `console.log` (PII leak serveur). Les endpoints `/verify` et `/lookup` retournent `first_name` et `student_id` dans leurs réponses.

**Conclusion : GO pour DemoGuard.** La base est saine, les hooks `useCamera` et `useAudio` sont réutilisables, et l'architecture proxy est un modèle propre pour DemoGuard.

---

## 2. Tableau des signaux

| Signal | Statut | Fichier concerné | Risque | Recommandation |
|---|---|---|---|---|
| Selfie capture (getUserMedia video) | **REAL** | `src/lib/camera.ts`, `src/hooks/useCamera.ts`, `src/steps/SelfieStep.tsx` | Faible — base64 envoyé au backend via proxy | Réutilisable tel quel pour DemoGuard |
| Reaction time (performance.now) | **REAL** | `src/steps/ReflexStep.tsx` | Faible — mesure locale, envoyée comme `reaction_ms` | Réutilisable tel quel |
| Audio capture (getUserMedia audio) | **REAL** | `src/hooks/useAudio.ts`, `src/lib/audio.ts` | Moyen — ScriptProcessor deprecated, MFCC naïf (DFT non-FFT) | Réutilisable mais optimiser avec AudioWorklet |
| MFCC vocal embedding | **REAL** | `src/lib/audio.ts` (`computeVocalEmbedding`) | Moyen — DFT O(n²) au lieu de FFT, qualité d'extraction limitée | Réutiliser l'approche mais migrer vers FFT |
| Vocal verify (cosine similarity) | **PARTIAL** | `src/lib/api.ts` (`vocalVerify`), backend `payguard.ts` | Faible — endpoint existe mais VoiceStep non câblé dans les flux | Câbler VoiceStep dans DemoGuard |
| Stroop test | **SIMULATED** | `src/steps/StroopStep.tsx` | Faible — composant existe mais non utilisé dans Enroll/Pay | Câbler dans DemoGuard si besoin cognitif |
| Digit Span test | **SIMULATED** | `src/steps/DigitSpanStep.tsx` | Faible — composant existe mais non utilisé | Câbler dans DemoGuard si besoin cognitif |
| VoiceStep (UI recording) | **SIMULATED** | `src/steps/VoiceStep.tsx` | Faible — composant existe mais non utilisé dans les flux | Câbler dans DemoGuard |
| Behavioral score | **SIMULATED** | Backend `payguard.ts` ligne 567 | Moyen — hardcoded `0.5`, aucun signal réel collecté | Collecter touch dynamics pour score réel |
| DeviceMotion / accelerometer | **MISSING** | — | Élevé — signal anti-bot clé absent | Ajouter `DeviceMotionEvent` listener |
| DeviceOrientation / gyroscope | **MISSING** | — | Élevé — signal anti-bot clé absent | Ajouter `DeviceOrientationEvent` listener |
| Touch dynamics (touchstart/pointer) | **MISSING** | — | Élevé — signal biométrique clé absent | Ajouter touch/pointer event tracking |
| Visibility / focus / blur | **MISSING** | — | Moyen — détection de triche par onglet | Ajouter `visibilitychange` listener |
| Network Information API | **MISSING** | — | Faible — signal secondaire | Optionnel pour DemoGuard |
| Permissions API | **MISSING** | — | Faible — signal secondaire | Optionnel pour DemoGuard |
| Online status | **REAL** | `src/hooks/useOnlineStatus.ts` | Faible — basique `navigator.onLine` | Réutilisable tel quel |
| Capacitor camera plugin | **MISSING** | `package.json` (installed but unused) | Faible — `getUserMedia` natif utilisé à la place | Pas nécessaire, `getUserMedia` fonctionne |
| Capacitor microphone plugin | **MISSING** | `package.json` (installed but unused) | Faible — `getUserMedia` natif utilisé à la place | Pas nécessaire |
| Capacitor appStateChange | **REAL** | `src/steps/VoiceStep.tsx` | Faible — utilisé pour détecter retour d'permissions | Réutilisable |

---

## 3. Liste des signaux actuellement collectés

### Signaux réels et actifs dans les flux

1. **Selfie capture** — `getUserMedia({ video: { facingMode: 'user' } })` → canvas → `toDataURL('image/jpeg', 0.8)` → base64. Utilisé dans `SelfieStep`, câblé dans Enroll et Pay.
   - Fichier : `src/lib/camera.ts:1-33`, `src/hooks/useCamera.ts:1-58`

2. **Reaction time** — `performance.now()` mesure le temps entre le signal "go" et le tap. Moyenne sur `REFLEX_ROUNDS` (3) tours. Utilisé dans `ReflexStep`, câblé dans Enroll et Pay.
   - Fichier : `src/steps/ReflexStep.tsx:1-129`

3. **Audio capture + MFCC** — `getUserMedia({ audio: true })` → `AudioContext` + `ScriptProcessor` → `Float32Array[]` → Hamming window → mel filterbank → DCT-II → 13 MFCC coefficients. Utilisé dans `VoiceStep` mais **VoiceStep n'est pas câblé dans les flux Enroll/Pay**.
   - Fichier : `src/hooks/useAudio.ts:1-59`, `src/lib/audio.ts:1-226`

4. **Online status** — `navigator.onLine` avec listeners `online`/`offline`. Hook disponible mais non utilisé dans les flux.
   - Fichier : `src/hooks/useOnlineStatus.ts:1-17`

5. **Capacitor appStateChange** — Listener sur `@capacitor/app` pour détecter le retour de réglages (permissions). Utilisé uniquement dans `VoiceStep`.
   - Fichier : `src/steps/VoiceStep.tsx:18-28`

### Signaux présents mais non câblés (simulés)

6. **Stroop test** — Composant `StroopStep.tsx` complet avec `STROOP_ROUNDS` tours. **Non importé dans aucune page.**
   - Fichier : `src/steps/StroopStep.tsx:1-70`

7. **Digit Span test** — Composant `DigitSpanStep.tsx` complet avec séquences aléatoires. **Non importé dans aucune page.**
   - Fichier : `src/steps/DigitSpanStep.tsx:1-82`

8. **VoiceStep** — Composant `VoiceStep.tsx` complet avec enregistrement audio et calcul d'embedding. **Non importé dans aucune page.**
   - Fichier : `src/steps/VoiceStep.tsx:1-88`

---

## 4. Liste des signaux manquants

| Signal | API requise | Priorité DemoGuard |
|---|---|---|
| DeviceMotion / accelerometer | `DeviceMotionEvent` + `window.addEventListener('devicemotion')` | **Haute** — signal anti-bot critique |
| DeviceOrientation / gyroscope | `DeviceOrientationEvent` + `window.addEventListener('deviceorientation')` | **Haute** — signal anti-bot critique |
| Touch dynamics | `touchstart`, `touchmove`, `touchend` ou `pointerdown`, `pointermove` | **Haute** — biométrie tactile |
| Visibility / tab switching | `visibilitychange`, `blur`, `focus` | **Moyenne** — détection de triche |
| Network Information API | `navigator.connection.effectiveType`, `rtt`, `downlink` | **Basse** — signal secondaire |
| Permissions API | `navigator.permissions.query({ name: 'camera' })` | **Basse** — signal secondaire |
| MediaRecorder (alternative audio) | `MediaRecorder` API | **Moyenne** — alternative à ScriptProcessor (deprecated) |
| Geolocation (optionnel) | `navigator.geolocation.getCurrentPosition` | **Basse** — à éviter sauf besoin explicite |

---

## 5. Liste des signaux à ne jamais exposer

### Côté client (PayGuard mobile)

| Signal / Donnée | Raison | Statut actuel |
|---|---|---|
| `HV_API_KEY` | Clé API backend — ne doit jamais être dans le bundle client | **CONFORME** — uniquement dans proxy Vercel |
| `X-API-Key` header | Injecté côté serveur par le proxy | **CONFORME** — absent de `api.ts` |
| `sessionToken` / `cognitiveSessionToken` | Token de session HCS — ne doit pas être envoyé depuis le mobile | **CONFORME** — absent du code |
| `hcsCode` | Code HCS généré côté backend | **CONFORME** — absent du code |
| `hcsResultToken` | Token de résultat HCS | **CONFORME** — absent du code |
| JWT / Bearer token | Token d'authentification | **CONFORME** — absent du code |
| `selfie_b64` dans les logs | PII biométrique | **CONFORME** — pas de `console.log` avec selfie dans le code client |
| `voice_b64` / `vocal_embedding` dans les logs | PII biométrique vocal | **CONFORME** — pas de logging client |
| `first_name`, `last_name`, `student_id` dans les logs | PII identitaire | **CONFORME** côté client. **NON CONFORME** côté backend (voir §5.2) |

### Côté backend (hybrid-vector-api) — risques identifiés

| Problème | Fichier | Ligne(s) | Gravité |
|---|---|---|---|
| `console.log` avec `first_name`, `last_name` | `src/routes/payguard.ts` | 187, 305-306, 498-499 | **Moyenne** — PII dans logs serveur |
| `console.log` avec `student_id` | `src/routes/payguard.ts` | 306, 499, 597 | **Moyenne** — PII dans logs serveur |
| `console.log` avec `sessionRow` complet (inclut PII) | `src/routes/payguard.ts` | 597 | **Élevée** — PII complète dans log |
| Réponse `/verify` contient `first_name` | `src/routes/payguard.ts` | 394 | **Moyenne** — PII dans réponse API |
| Réponse `/lookup` contient `first_name` | `src/routes/payguard.ts` | 284 | **Moyenne** — PII dans réponse API |
| `emitHcsIngest` metadata contient `first_name`, `last_name`, `student_id` | `src/routes/payguard.ts` | 457-461, 663-668, 820-825 | **Moyenne** — PII envoyée à HCS-U7 |

### Côté proxy Vercel (`api/_lib/proxy.ts`)

| Problème | Gravité | Statut |
|---|---|---|
| PII dans les logs proxy | **CONFORME** — `safeLog()` ne logue que `endpoint`, `status`, `durationMs`, `origin`, `requestId` | OK |
| `HV_API_KEY` dans le code client | **CONFORME** — `process.env.HV_API_KEY` côté serveur uniquement | OK |
| `tenant_id` client surchargé | **CONFORME** — `applyTenantOverride()` remplace par `PAYGUARD_TENANT_ID` | OK |

---

## 6. Recommandation d'extraction vers DemoGuard

### Composants réutilisables directement

| Composant | Fichier | Réutilisable | Modifications nécessaires |
|---|---|---|---|
| `useCamera` hook | `src/hooks/useCamera.ts` | Oui | Aucune — API propre |
| `useAudio` hook | `src/hooks/useAudio.ts` | Oui | Migrer `ScriptProcessor` → `AudioWorklet` (futur) |
| `useOnlineStatus` hook | `src/hooks/useOnlineStatus.ts` | Oui | Aucune |
| `camera.ts` lib | `src/lib/camera.ts` | Oui | Aucune |
| `audio.ts` lib (MFCC) | `src/lib/audio.ts` | Oui avec réserves | Optimiser DCT/DFT, ajouter FFT |
| `ReflexStep` | `src/steps/ReflexStep.tsx` | Oui | Aucune |
| `SelfieStep` | `src/steps/SelfieStep.tsx` | Oui | Aucune |
| `StroopStep` | `src/steps/StroopStep.tsx` | Oui | À câbler dans le flux |
| `DigitSpanStep` | `src/steps/DigitSpanStep.tsx` | Oui | À câbler dans le flux |
| `VoiceStep` | `src/steps/VoiceStep.tsx` | Oui | À câbler dans le flux |
| `flowReducer` | `src/state/flowReducer.ts` | Oui | Étendre avec nouveaux signaux |
| `types/flow.ts` | `src/types/flow.ts` | Oui | Étendre avec `CapturedData` enrichi |
| Proxy Vercel | `api/_lib/proxy.ts` | Oui (modèle) | Cloner avec `demoguard` au lieu de `payguard` |
| `withRetry` | `src/lib/retry.ts` | Oui | Aucune |
| `storage/queue.ts` | `src/storage/queue.ts` | Oui | Renommer DB name |

### Composants à créer pour DemoGuard

| Composant | Priorité | Description |
|---|---|---|
| `useDeviceMotion` hook | **Haute** | Listener `devicemotion` → accumulateur de `accelerationIncludingGravity` |
| `useDeviceOrientation` hook | **Haute** | Listener `deviceorientation` → `alpha`, `beta`, `gamma` |
| `useTouchDynamics` hook | **Haute** | Track `touchstart`/`touchend` → intervalles, pression, surface |
| `useVisibility` hook | **Moyenne** | `visibilitychange` → compteur de switches, durée hidden |
| `useNetworkInfo` hook | **Basse** | `navigator.connection` → `effectiveType`, `rtt`, `downlink` |
| `usePermissions` hook | **Basse** | `navigator.permissions.query()` → statut caméra/micro |

---

## 7. Proposition de structure DemoGuard

```
demoguard/
├── api/
│   ├── _lib/
│   │   └── proxy.ts              # Cloné de payguard, renommé DEMOGUARD_*
│   └── demoguard/
│       ├── enroll.ts
│       ├── verify.ts
│       └── pay-verify.ts
├── src/
│   ├── components/               # UI shared (Button, Spinner, ErrorState)
│   ├── constants/
│   │   ├── config.ts             # VITE_API_URL, VITE_TENANT_ID=demoguard-demo
│   │   └── routes.ts
│   ├── hooks/
│   │   ├── useCamera.ts          # Réutilisé de payguard
│   │   ├── useAudio.ts           # Réutilisé de payguard
│   │   ├── useOnlineStatus.ts    # Réutilisé de payguard
│   │   ├── useDeviceMotion.ts    # NOUVEAU
│   │   ├── useDeviceOrientation.ts # NOUVEAU
│   │   ├── useTouchDynamics.ts   # NOUVEAU
│   │   ├── useVisibility.ts      # NOUVEAU
│   │   └── useNetworkInfo.ts     # NOUVEAU (optionnel)
│   ├── lib/
│   │   ├── api.ts                # Adapté de payguard, endpoints demoguard/*
│   │   ├── camera.ts             # Réutilisé de payguard
│   │   ├── audio.ts              # Réutilisé de payguard (MFCC)
│   │   ├── retry.ts              # Réutilisé de payguard
│   │   └── settings.ts           # Adapté de payguard
│   ├── pages/
│   │   ├── Home.tsx
│   │   ├── Enroll.tsx            # Flux: identity → selfie → reflex → voice → stroop → digit-span
│   │   ├── Verify.tsx            # Flux: identity → selfie → reflex → voice → decision
│   │   └── Result.tsx
│   ├── steps/
│   │   ├── SelfieStep.tsx        # Réutilisé de payguard
│   │   ├── ReflexStep.tsx        # Réutilisé de payguard
│   │   ├── VoiceStep.tsx         # Réutilisé de payguard (câblé cette fois)
│   │   ├── StroopStep.tsx        # Réutilisé de payguard (câblé cette fois)
│   │   └── DigitSpanStep.tsx     # Réutilisé de payguard (câblé cette fois)
│   ├── state/
│   │   └── flowReducer.ts        # Étendu avec motion, orientation, touch, visibility
│   ├── storage/
│   │   └── queue.ts              # Réutilisé, DB name "demoguard"
│   ├── types/
│   │   └── flow.ts               # Étendu avec CapturedData enrichi
│   └── ui/
│       ├── Button.tsx
│       ├── ErrorState.tsx
│       └── Spinner.tsx
├── tests/
│   ├── dg1-signal-audit.test.ts  # Tests statiques (clonés de payguard)
│   └── proxy.test.ts             # Tests proxy (clonés de payguard)
├── capacitor.config.json         # appId: com.iasolution.demoguard
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── vercel.json
```

### Étapes de création DemoGuard

1. **Cloner payguard** → `demoguard/`
2. **Renommer** : `payguard` → `demoguard` dans configs, env vars, DB names, routes API
3. **Câbler** les steps non utilisés (VoiceStep, StroopStep, DigitSpanStep) dans le flux Enroll
4. **Créer** les hooks manquants (useDeviceMotion, useDeviceOrientation, useTouchDynamics, useVisibility)
5. **Étendre** `flowReducer` et `types/flow.ts` avec les nouveaux signaux
6. **Adapter** `api.ts` pour envoyer les nouveaux signaux au backend
7. **Configurer** `VITE_TENANT_ID=demoguard-demo` et `PAYGUARD_TENANT_ID=demoguard-demo` (ou `DEMOGUARD_TENANT_ID`)
8. **Tester** avec les tests statiques DG-1

---

## 8. Tests existants impactés

### Tests existants (avant audit)

| Fichier | Tests | Statut | Impact DemoGuard |
|---|---|---|---|
| `tests/proxy.test.ts` | 15 | **PASS** | Cloner et adapter pour DemoGuard proxy |
| `tests/pg4-demo-bridge.test.ts` | 11 | **PASS** | Cloner et adapter pour DemoGuard (hcs_session_public_id, flowReducer) |

### Tests créés par cet audit

| Fichier | Tests | Statut | Description |
|---|---|---|---|
| `tests/dg1-signal-audit.test.ts` | 23 | **PASS** | Tests statiques prouvant la conformité sécurité |

#### Détail des tests DG-1 (23 tests)

- **No API key client-side (6 tests)** : pas de `HV_API_KEY`, `X-API-Key`, `Authorization`, `NEXT_PUBLIC_`, secrets hardcoded dans `src/`
- **No sessionToken / hcsCode / JWT (5 tests)** : pas de `sessionToken`, `cognitiveSessionToken`, `hcsCode`, `hcsResultToken`, `jwt` dans `src/`
- **No PII in pay-verify response (2 tests)** : return type de `payVerify` ne contient pas `first_name`, `last_name`, `student_id`, `selfie_b64`, `vocal_embedding`
- **hcs_session_public_id optional (3 tests)** : champ optionnel dans le payload, `FlowState.hcsSessionPublicId` nullable, `initialFlowState` initialise à `null`
- **Missing signals confirmation (6 tests)** : confirme statiquement l'absence de `DeviceMotionEvent`, `DeviceOrientationEvent`, `touchstart`, `pointerdown`, `visibilitychange`, `navigator.connection`, `navigator.permissions`
- **Tenant override server-side (1 test)** : `PAYGUARD_TENANT_ID` surcharge côté proxy

---

## 9. Résultats des commandes

| Commande | Résultat |
|---|---|
| `npx vitest run` | **49 tests passed** (3 files: dg1-signal-audit 23, pg4-demo-bridge 11, proxy 15) |
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **Success** — 54 modules, 193.21 KB (gzip: 63.04 KB), built in 997ms |

---

## 10. Fichiers lus

### PayGuard repo

| Fichier | Lignes | Objet |
|---|---|---|
| `package.json` | 1-43 | Dépendances, scripts |
| `src/App.tsx` | 1-21 | Routing principal |
| `src/lib/api.ts` | 1-144 | Client API (enroll, verify, payVerify, etc.) |
| `src/lib/camera.ts` | 1-33 | Capture selfie via getUserMedia |
| `src/lib/audio.ts` | 1-226 | Capture audio + MFCC |
| `src/lib/retry.ts` | 1-19 | Retry helper |
| `src/lib/settings.ts` | 1-24 | Ouverture réglages natifs |
| `src/hooks/useCamera.ts` | 1-58 | Hook caméra |
| `src/hooks/useAudio.ts` | 1-59 | Hook audio |
| `src/hooks/useOnlineStatus.ts` | 1-17 | Hook online status |
| `src/steps/SelfieStep.tsx` | 1-63 | UI selfie capture |
| `src/steps/ReflexStep.tsx` | 1-129 | UI temps de réaction |
| `src/steps/VoiceStep.tsx` | 1-88 | UI capture vocale (non câblé) |
| `src/steps/StroopStep.tsx` | 1-70 | UI Stroop (non câblé) |
| `src/steps/DigitSpanStep.tsx` | 1-82 | UI Digit Span (non câblé) |
| `src/pages/Home.tsx` | 1-40 | Page d'accueil |
| `src/pages/Enroll.tsx` | 1-158 | Flux enrollment |
| `src/pages/Pay.tsx` | 1-207 | Flux paiement |
| `src/pages/Result.tsx` | 1-62 | Page résultat |
| `src/state/flowReducer.ts` | 1-44 | Reducer state |
| `src/types/flow.ts` | 1-57 | Types flow |
| `src/storage/queue.ts` | 1-51 | Persistance IndexedDB |
| `src/constants/config.ts` | 1-10 | Config env vars |
| `src/constants/routes.ts` | 1-7 | Routes constantes |
| `capacitor.config.json` | 1-21 | Config Capacitor |
| `vercel.json` | 1-18 | Config Vercel |
| `vite.config.ts` | 1-8 | Config Vite |
| `vitest.config.ts` | 1-9 | Config Vitest |
| `tsconfig.json` | 1-16 | Config TypeScript |
| `.env.production.example` | 1-24 | Variables env production |
| `.env.unipay` | 1-3 | Variables env unipay |
| `api/_lib/proxy.ts` | 1-324 | Proxy Vercel serverless |
| `api/payguard/enroll.ts` | 1-4 | Route proxy enroll |
| `api/payguard/verify.ts` | 1-4 | Route proxy verify |
| `api/payguard/pay-verify.ts` | 1-4 | Route proxy pay-verify |
| `api/payguard/vocal-verify.ts` | 1-4 | Route proxy vocal-verify |
| `api/payguard/auth-payment-signals.ts` | 1-4 | Route proxy auth-payment-signals |
| `api/payguard/lookup.ts` | 1-4 | Route proxy lookup |
| `tests/proxy.test.ts` | 1-392 | Tests proxy existants |
| `tests/pg4-demo-bridge.test.ts` | 1-228 | Tests demo bridge existants |

### Hybrid-Vector-API repo (read-only)

| Fichier | Lignes | Objet |
|---|---|---|
| `src/routes/payguard.ts` | 1-840 | Endpoints backend payguard |

---

## 11. Fichiers créés/modifiés

| Fichier | Action | Description |
|---|---|---|
| `tests/dg1-signal-audit.test.ts` | **CRÉÉ** | 23 tests statiques prouvant la conformité sécurité |
| `DG1_SIGNAL_AUDIT_REPORT.md` | **CRÉÉ** | Ce rapport |

Aucun fichier source modifié. Aucun refactor. Audit uniquement.

---

## 12. Conclusion GO / NO-GO

### **GO pour créer DemoGuard**

**Justification :**

1. **Base code saine et réutilisable** — Les hooks `useCamera`, `useAudio`, `useOnlineStatus` et les steps `SelfieStep`, `ReflexStep`, `VoiceStep`, `StroopStep`, `DigitSpanStep` sont directement réutilisables.
2. **Architecture proxy sécurisée** — Le modèle `api/_lib/proxy.ts` avec injection `HV_API_KEY` côté serveur, CORS allowlist, rate limiting, et tenant override est un modèle propre à cloner.
3. **Sécurité client-side conforme** — 23 tests statiques prouvent l'absence de clés API, tokens, et PII dans les réponses `pay-verify`.
4. **Signaux manquants identifiés** — DeviceMotion, DeviceOrientation, touch dynamics, et visibility sont les 4 signaux prioritaires à ajouter.
5. **Composants simulés déjà codés** — StroopStep, DigitSpanStep, VoiceStep existent et n'ont qu'à être câblés dans le flux.

**Conditions pour le GO :**

- Cloner le repo payguard → demoguard (pas de modification de payguard)
- Renommer tous les `payguard` → `demoguard` (configs, env, DB, routes)
- Créer les 4 hooks manquants prioritaires (motion, orientation, touch, visibility)
- Câbler VoiceStep, StroopStep, DigitSpanStep dans le flux DemoGuard
- Cloner et adapter les tests statiques DG-1
- **Recommandation backend** : Nettoyer les `console.log` avec PII dans `hybrid-vector-api/src/routes/payguard.ts` avant de créer les endpoints DemoGuard

---

*© 2026 Benjamin BARRERE / IA SOLUTION — Patents Pending FR2514274 | FR2514546*
