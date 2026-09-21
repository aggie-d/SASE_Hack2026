# LAD Transfer

## Jira Link
https://agronildas.atlassian.net/?continue=https%3A%2F%2Fagronildas.atlassian.net%2Fwelcome%2Fsoftware%3FprojectId%3D10001&atlOrigin=eyJpIjoiZjMxM2I4YmI2ZTEyNDlkMTgyYmJjYmIyZjVlNTdmZjEiLCJwIjoiamlyYS1zb2Z0d2FyZSJ9

## Devpost Link

https://devpost.com/software/1435244/joins/CZ8OF6byHyxB46CdRptdYQ

## Figma Link
https://www.figma.com/design/o0G7GSfx08dRRVCV4s8QuZ/SASEHack?node-id=0-1&t=9K78YISFETSsfSJf-1

## Tech Stacks

React Framework through NextJS
BRIDGE.xyz API
Azure For Deployment
SupaBase for Database
Figma for design

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Starter screens: `/`, `/login`, and `/dashboard`. Add more pages under `app/`. Shared UI goes in `components/`. Shared types go in `lib/contracts/`. See `Malawi-Wallet-Team-Brief.md` for the product and API contracts.

## Running with Docker

### Using Docker Compose (Recommended)

1. Ensure your `.env.local` or `.env` file is present in the project root if you are using custom Supabase credentials (a demo mode fallback is enabled by default).
2. Build and start the container:
   ```bash
   docker compose up --build
   ```
3. Open [http://localhost:3000](http://localhost:3000).

To run in the background (detached mode):
```bash
docker compose up -d
```
To stop the container:
```bash
docker compose down
```

### Using Docker Directly

1. Build the image:
   ```bash
   docker build -t lad-transfer .
   ```
2. Run the container:
   ```bash
   docker run -p 3000:3000 --env-file .env.local lad-transfer
   ```
