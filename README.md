# AutoRate Atlas

AutoRate Atlas is a production-ready, no-login web app that estimates auto insurance cost ranges for a specific area using public risk signals.

> **Important:** This app provides transparent **estimates**, not carrier-issued quotes.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (glassmorphism UI)
- Framer Motion
- Recharts
- Netlify Functions

## Features

- Premium dark-first glass UI with responsive layout
- Autocomplete location search (Nominatim) + browser geolocation
- Vehicle make/model live suggestions from NHTSA vPIC + profile inputs
- Results dashboard with:
  - Monthly and yearly estimate bands
  - Confidence and risk score
  - Risk factor chart and explanations
  - “Why this area?” context
  - Source attribution panel
  - Methodology panel
- Loading, empty, error, and fallback states
- Fallback estimator if live source is unavailable
- Cached client geocoding/model lookups to reduce repeated API calls

## Data and estimation approach

The app combines multiple **live public signals** in a weighted pipeline:

1. Open-Meteo weather severity feed
2. OpenStreetMap Overpass road/network complexity feed
3. FCC block lookup + U.S. Census ACS socioeconomic context
4. U.S. BLS motor-vehicle-insurance trend signal
5. NHTSA vPIC vehicle taxonomy + make/model normalization
6. Driver-profile modifiers (age range, driving history, optional gender)
7. Confidence scoring based on live feed availability

Output includes:

- low / likely / high monthly estimate
- yearly estimate range
- confidence score + explanation
- top contributing factors
- source names and attribution links

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Netlify deployment

1. Connect repo to Netlify.
2. Build settings (already in `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
3. Add any optional env vars from `.env.example` in Netlify site settings.
4. Deploy.

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
