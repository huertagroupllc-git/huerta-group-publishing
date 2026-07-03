# Huerta Group Publishing

Official publishing imprint and digital platform for Huerta Group Publishing, including book projects, author tools, and publishing operations.

Huerta Group Publishing helps authors create books that sound more like themselves, not more like AI. Conversation is where ideas are discovered; this platform is where they are preserved, structured, versioned, and reused.

## Stack

Next.js (App Router, TypeScript) · Tailwind · Supabase · Vercel · GitHub. Production-first: push to `main` deploys to production.

## Project documents

- [Milestone 1 blueprint — the Author Memory System](docs/blueprints/milestone-1-author-memory-system.md)
- [Setup — environment variables, migrations, manual Supabase steps](docs/setup.md)

## Development

```sh
pnpm install
pnpm dev
```

Requires the environment variables described in [docs/setup.md](docs/setup.md) (see `.env.example`).
