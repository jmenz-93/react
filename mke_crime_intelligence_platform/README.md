# MKE Crime Intelligence Platform

<img width="1000" height="500" alt="Screenshot 2026-04-30 at 7 19 08 PM" src="https://github.com/user-attachments/assets/86354cc4-3538-4b37-ac98-a4dfbd7f87a2" />

A frontend application that lets users:

- Upload a Milwaukee Police Department crime CSV file.
- Explore incidents and hotspot overlays on a map.
- Analyze trend patterns by month, offense, district, and day.
- Ask an LLM-backed chatbot questions about trends, tactical interventions, and likely hotspot growth.

## Tech Stack

- React + TypeScript + Vite
- Leaflet (map rendering)
- PapaParse (CSV parsing in browser)
- Recharts (trend charts)

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open the local URL printed by Vite.

## LLM Configuration

The chat panel supports two modes:

- Local fallback mode if no API key is provided.
- OpenAI-compatible API mode if key and endpoint are provided.

Optional environment variables:

- `VITE_OPENAI_API_KEY`
- `VITE_OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
- `VITE_OPENAI_MODEL` (default: `gpt-4o-mini`)

Create `.env` from `.env.example` if needed.
