# PayGuard — Biometric Payroll Validation

Biometric payroll validation app for workers in South Africa. Workers confirm salary receipt with their face. Powered by AWS Rekognition and Hybrid Vector technology (3 French patents).

## Features

- **Worker Enrollment**: 6-step biometric registration process
  - Identity information capture
  - Facial recognition via selfie
  - Cognitive baseline tests (Stroop, Neural Reflex, Vocal Imprint, Reaction Time)
  
- **Payment Confirmation**: Secure payroll validation flow
  - Payment details entry (name, employee ID, amount, period, employer)
  - Selfie capture
  - Instant facial match verification
  - Biometrically certified confirmation

- **Security**: AWS Rekognition facial matching with ML-KEM FIPS 203 encryption

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **Routing**: React Router v6
- **Styling**: Custom CSS with dark theme
- **API**: Hybrid Vector API (https://hybrid-vector-api-m5xt.onrender.com)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the root directory:

```env
VITE_API_URL=/api
VITE_TENANT_ID=payguard-demo
# HV_API_KEY is server-side only (Vercel env var) — never in VITE_
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
payguard/
├── src/
│   ├── components/       # React components
│   │   ├── SelfieCapture.tsx
│   │   ├── StroopTest.tsx
│   │   ├── NeuralReflex.tsx
│   │   ├── VocalImprint.tsx
│   │   └── ReactionTime.tsx
│   ├── pages/           # Page components
│   │   ├── Home.tsx
│   │   ├── Enroll.tsx
│   │   └── PaymentConfirm.tsx
│   ├── hooks/           # Custom React hooks
│   │   └── useCamera.ts
│   ├── services/        # API services
│   │   └── api.ts
│   ├── store/           # Zustand store
│   │   └── payguardStore.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Routes

- `/` - Home page with Register and Confirm Payment options
- `/enroll` - Worker enrollment flow (6 steps)
- `/confirm` - Payment confirmation flow (3 steps)

## Design

- **Theme**: Dark mode (#0a0f1e background)
- **Accent**: Green (#22c55e) - representing payments and trust
- **Layout**: Mobile-first, centered (max-width 480px)
- **Typography**: Inter font family

## API Integration

The app integrates with the Hybrid Vector API for:
- Worker enrollment (`POST /edguard/enroll`)
- Identity verification (`POST /edguard/verify`)

## License

MIT

## Author

Hybrid Vector / CoreHuman
