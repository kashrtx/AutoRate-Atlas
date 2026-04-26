# AutoRate Atlas

**Live App → [autorate-atlas.netlify.app](https://autorate-atlas.netlify.app/)**

AutoRate Atlas is a production-ready, no-login web app that estimates auto insurance cost ranges for a specific area using public risk signals and an in-browser AI.

> **Important:** This app provides transparent **estimates**, not carrier-issued quotes.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (glassmorphism UI)
- Framer Motion
- Recharts
- Netlify Functions
- WebLLM (Microsoft Phi-4 Mini — runs locally in-browser via WebGPU)

## Features

- Premium dark-first glass UI with responsive layout
- Autocomplete location search (Nominatim) + browser geolocation
- Vehicle make/model live suggestions from NHTSA vPIC + profile inputs
- **In-browser AI** (Microsoft Phi-4 Mini via WebLLM/WebGPU) for vehicle valuation, insurance group classification, and personalized insights
- Ability to clear cached AI model from browser storage
- Results dashboard with:
  - Monthly and yearly estimate bands
  - Confidence and risk score
  - Risk factor chart and explanations
  - "Why this area?" context
  - AI Insights panel with tips, vehicle and location analysis
  - Source attribution panel
  - Methodology panel
- Loading, empty, error, and fallback states
- Fallback estimator if live source is unavailable
- Cached client geocoding/model lookups to reduce repeated API calls

## Data and estimation approach

The app uses a three-layer architecture:

**Layer 1 — State baselines:** Real state-level insurance baselines for all 50 states + DC, calibrated from 2025/2026 Insurify and Experian data.

**Layer 2 — Actuarial GLM:** A Generalized Linear Model with multiplicative rating factors combining:
1. Open-Meteo weather severity feed
2. OpenStreetMap Overpass road/network complexity feed
3. FCC block lookup + U.S. Census ACS socioeconomic context
4. U.S. BLS motor-vehicle-insurance trend signal
5. NHTSA vPIC vehicle taxonomy + make/model normalization
6. Driver-profile modifiers (age range, driving history, optional gender)
7. Confidence scoring based on live feed availability

**Layer 3 — AI enhancement:** Microsoft Phi-4 Mini (3.8B parameters) running locally in the browser via WebLLM/WebGPU. Provides vehicle valuation, insurance group classification, and personalized analysis. AI estimate is blended 30/70 with the actuarial model.

Output includes:

- low / likely / high monthly estimate
- yearly estimate range
- confidence score + explanation
- top contributing factors
- AI-generated insights and tips
- source names and attribution links

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

For Netlify Functions locally:

```bash
npm run dev:netlify
```

## Function endpoint

- `POST /.netlify/functions/estimate`
- Request body includes location, vehicle, and profile fields.
- Response returns estimate bands, confidence, risk factors, context, charts, and sources.

## Accessibility and trust notes

- Keyboard-friendly form controls
- Labels and semantic structure
- High-contrast text in both dark and light themes
- No account creation required
- Optional sensitive inputs (e.g., gender)
- Explicit disclaimer that outputs are not guaranteed quotes

## Repository hygiene

- Keep repository changes text-based where possible in this environment.
- Avoid adding binary assets to PR diffs if Codex reports `Binary files are not supported`.
