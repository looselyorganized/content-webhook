# lo-content-webhook

Standalone Bun HTTP server that syncs `.lo/` project content to Supabase via GitHub push webhooks.

## How it works

1. GitHub sends a push webhook to `/webhook/github`
2. The server verifies the HMAC-SHA256 signature
3. If the push touches any `.lo/` files, it fetches and parses:
   - `.lo/PROJECT.md` — project metadata
   - `.lo/hypotheses/*.md` — hypothesis entries
   - `.lo/stream/*.md` — stream/milestone entries
   - Repository contributors
4. Parsed content is upserted to Supabase

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/webhook/github` | POST | GitHub push webhook receiver |
| `/health` | GET | Health check (returns `ok`) |

## Environment variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `GITHUB_WEBHOOK_SECRET` | Shared HMAC secret configured in GitHub webhook settings |
| `GITHUB_TOKEN` | GitHub PAT with `contents:read` for fetching `.lo/` files |
| `PORT` | Server port (default: `3001`) |

## Development

```bash
bun install
bun run dev      # watch mode
bun test         # run tests
```

## Deployment

Deployed to Railway via Dockerfile. See `railway.toml` for config.
