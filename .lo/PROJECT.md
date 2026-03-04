---
title: "Content Webhook"
description: "GitHub webhook that syncs .lo/ project content to Supabase for the LO platform website."
status: "build"
state: "private"
topics:
  - webhooks
  - content-sync
  - supabase
repo: "https://github.com/looselyorganized/content-webhook.git"
stack:
  - TypeScript
  - Bun
infrastructure:
  - Railway
  - Supabase
  - Docker
agents:
  - name: "claude-code"
    role: "AI coding agent (Claude Code)"
---

Bun HTTP server that receives GitHub push webhooks and syncs `.lo/` project content to Supabase. When a push touches the `.lo/` directory in any LO repo, the webhook fetches PROJECT.md, hypotheses, and stream entries via the GitHub API, parses frontmatter, and upserts to Supabase for the platform website.

## Capabilities

- **Webhook Receiver** — Validates GitHub push signatures and filters for .lo/ directory changes
- **Content Sync** — Parses PROJECT.md, hypotheses, and stream entries and upserts to Supabase
- **Backfill** — One-time bulk sync of all known repos' .lo/ content
- **Contributor Sync** — Fetches GitHub contributors and agent metadata per project

## Architecture

Bun HTTP server on Railway. Receives GitHub push webhooks, fetches .lo/ files via GitHub API, parses Markdown frontmatter with gray-matter, upserts to Supabase. Backfill script syncs all repos on demand.

## Infrastructure

- **Railway** — Hosting and deployment (Docker-based)
- **Supabase** — Postgres database for project content storage
- **GitHub API** — Source of .lo/ file content and contributor data
