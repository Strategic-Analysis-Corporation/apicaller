# API Explorer

Web-based financial API explorer for SAC analysts. Calls QuoteMedia, Fiscal.ai, EODHD, and FMP APIs through a secure server-side proxy. Ported from the desktop Python app (API Explorer v1.1.2) .

## Features

- 13 API endpoints across 4 platforms
- JSON and table views with auto-detection of data structures
- Sortable columns, newest-first ordering
- Excel and JSON export
- Tabbed results with error diagnostics
- Split-screen tab comparison
- Provider issue reporting with email drafts and generated attachment files
- API keys stay server-side (never sent to the browser)

## Local Development

**Requirements:** Node.js 20+

```bash
# 1. Install dependencies
npm install

# 2. Set up API keys
cp .env.example .env.local
# Edit .env.local and fill in the real API keys

# 3. Run dev server
npm run dev
```

Open http://localhost:3000

## Environment Variables

These go in `.env.local` locally, or in Vercel's dashboard for production. **Never commit real keys.**

| Variable | Description |
|----------|-------------|
| `QM_TOKEN` | QuoteMedia Bearer token |
| `QM_WEBMASTER_ID` | QuoteMedia webmaster ID |
| `FISCAL_API_KEY` | Fiscal.ai API key |
| `EODHD_API_TOKEN` | EODHD API token |
| `FMP_API_KEY` | Financial Modeling Prep API key |
| `NEXT_PUBLIC_PROVIDER_SUPPORT_EMAILS` | Optional semicolon-separated support recipients for issue-report email drafts, e.g. `FMP=support@example.com;Fiscal.ai=support@example.com`. Do not commit private aliases unless they are intentionally public. |

## Provider Issue Reports

Each result tab has a **Report Data Issue** action. It can open a prefilled mail client draft and generate attachment files for manual email workflows:

- issue summary markdown
- request metadata JSON
- diagnostics JSON
- raw API response JSON
- Excel workbook when table data is available

Generated issue files redact secret-like fields such as API keys, tokens, auth headers, cookies, and passwords before download.

## Deploy to Vercel

### First-time setup

1. Push this repo to GitHub (make sure `.env.local` is NOT included — it's in `.gitignore`)

2. Go to [vercel.com](https://vercel.com) and sign in with GitHub

3. Click **"Add New Project"** and import this repository

4. In the **Environment Variables** section, add all 5 variables from the table above with the real values

5. Set the **Node.js Version** to `20.x` in Settings > General (if it doesn't auto-detect)

6. Click **Deploy** — Vercel will build and give you a URL

### Updating after code changes

Just push to `main`. Vercel auto-deploys on every push.

### Custom domain (optional)

In Vercel dashboard: Settings > Domains > Add your domain and follow the DNS instructions.

## Project Structure

```
apicaller/
├── app/
│   ├── page.tsx                  # Main single-page app
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Tailwind + custom styles
│   └── api/fetch-data/route.ts   # Server-side API proxy (keys stay here)
├── components/                   # React UI components
│   ├── PlatformSelector.tsx      # Platform buttons
│   ├── CallSelector.tsx          # API call list
│   ├── ParamForm.tsx             # Dynamic parameter form
│   ├── ResultTabs.tsx            # Tab bar
│   ├── JsonView.tsx              # Syntax-highlighted JSON
│   ├── TableView.tsx             # Auto-detecting data tables
│   └── ExportButtons.tsx         # JSON + Excel download
├── lib/
│   ├── platforms.ts              # Platform & endpoint config
│   └── types.ts                  # TypeScript types
├── public/data/
│   └── fiscal_ratios.json        # Searchable ratio list (1000+)
├── .env.example                  # Template for env setup
└── .env.local                    # Real API keys (gitignored)
```

## Security

- API keys are only in `.env.local` (gitignored) or Vercel env vars
- The `/api/fetch-data` route runs server-side — keys never reach the browser
- No API keys exist in any source file
- `.gitignore` blocks `.env*`, AI config files, and OS metadata
