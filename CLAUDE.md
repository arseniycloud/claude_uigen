# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # Install deps, generate Prisma client, run migrations (first-time setup)
npm run dev            # Start dev server with Turbopack
npm run dev:daemon     # Start dev server in background, logs to logs.txt (check this file for output)
npm run build          # Production build
npm run lint           # Run ESLint (config: next)
npm test               # Run vitest test suite (watch mode by default)
npm run db:reset       # Reset SQLite dev database (destructive)
```

Run a single test file: `npx vitest run src/lib/__tests__/file-system.test.ts`
Run tests matching a name: `npx vitest run -t "test name pattern"`

No API key is required to run the app — see "Mock provider" below.

## Architecture

UIGen is an AI chat app that generates React components with a live preview, using a **virtual, in-memory file system** — no files are ever written to disk during generation.

### The virtual file system is the core abstraction

`src/lib/file-system.ts` (`VirtualFileSystem`) implements an in-memory tree of files/directories (path → `FileNode`, backed by `Map`s), with an Anthropic-text-editor-style API (`view`, `create` w/ auto-parent-dirs, `str_replace`, `insert`) plus rename/delete. It supports `serialize()`/`deserializeFromNodes()` for persisting to/from Prisma's `Project.data` JSON column and for passing state between client and the `/api/chat` route.

Every layer touches this same abstraction:
- **Server**: `src/app/api/chat/route.ts` reconstructs a `VirtualFileSystem` from the client-sent `files` payload on every request (it is *not* persisted server-side between requests except when saved to a `Project` row at the end via `onFinish`).
- **AI tools**: `src/lib/tools/str-replace.ts` and `src/lib/tools/file-manager.ts` wrap `VirtualFileSystem` methods as Vercel AI SDK tools (`str_replace_editor`, `file_manager`) that the model calls to create/edit/rename/delete files.
- **Client**: `src/lib/contexts/file-system-context.tsx` (`FileSystemProvider`) holds the client-side mirror of the same `VirtualFileSystem`, and applies the *same* tool calls (`handleToolCall`) as they stream in from the AI SDK, keeping the editor/preview in sync with what the model just did.

### Preview rendering (no bundler)

`src/lib/transform/jsx-transformer.ts` transforms every in-memory file with Babel standalone (JSX/TSX → JS) in the browser, wraps each transformed file in a `Blob` URL, and builds a browser-native `importmap` (`createImportMap`) mapping bare/relative/`@/`-aliased import specifiers to those blob URLs. Third-party packages resolve to `esm.sh`. `createPreviewHTML` assembles a full standalone HTML document (with Tailwind via CDN script, an import map, and a React error boundary) that's rendered inside an iframe (`src/components/preview/PreviewFrame.tsx`). Missing local imports get an auto-generated placeholder module rather than a hard error, so partial/in-progress generations still render.

### Chat/generation flow

1. `src/lib/contexts/chat-context.tsx` drives the Vercel AI SDK `useChat`, posting `{ messages, files, projectId }` to `/api/chat`.
2. `src/app/api/chat/route.ts` prepends `generationPrompt` (`src/lib/prompts/generation.tsx`) as a cached system message, rebuilds the `VirtualFileSystem`, and streams a response with the two file tools attached. On finish, if `projectId` is present and the request is authenticated, the full message history + serialized file system are saved to the `Project` row.
3. Streamed tool calls are mirrored into the client's `VirtualFileSystem` via `FileSystemProvider.handleToolCall`, which drives both `FileTree`/`CodeEditor` and the live preview.

### Mock provider (no API key required)

`src/lib/provider.ts`: `getLanguageModel()` returns a real `anthropic(MODEL)` client if `ANTHROPIC_API_KEY` is set, otherwise a hand-rolled `MockLanguageModel` that fakes a multi-step tool-calling conversation (creates a canned component, "enhances" it via `str_replace`, then creates `App.jsx`) by pattern-matching keywords in the user's prompt (`form`/`card`/default counter). When modifying the chat flow, remember behavior can differ meaningfully between the real and mock providers (see `isMockProvider` step-count branching in the chat route).

### Auth & persistence

- Custom JWT session auth (`jose`) in `src/lib/auth.ts`, cookie-based (`auth-token`), no external auth library.
- `src/middleware.ts` protects `/api/projects` and `/api/filesystem` paths, requiring a valid session.
- Prisma + SQLite (`prisma/schema.prisma`): `User` and `Project` (project stores `messages` and `data` as JSON strings, not relations). Prisma client is generated to `src/generated/prisma` (custom output path, not `node_modules/.prisma`) — re-run `npx prisma generate` after schema changes.
- Anonymous users get a working session without an account: `src/lib/anon-work-tracker.ts` stashes in-progress messages/file-system state in `sessionStorage` so it can be claimed/migrated after sign-up.

### UI structure

- `src/app/[projectId]/page.tsx` and `src/app/page.tsx` are the project and home routes; `src/app/main-content.tsx` wires together the resizable chat/editor/preview panes (`react-resizable-panels`).
- `src/components/chat/*` — chat UI (`ChatInterface`, `MessageList`, `MessageInput`, `MarkdownRenderer`).
- `src/components/editor/*` — `FileTree` and `CodeEditor` (Monaco).
- `src/components/preview/PreviewFrame.tsx` — the iframe preview described above.
- `src/components/ui/*` — shadcn/ui components (style: "new-york", see `components.json`); path aliases `@/components`, `@/lib`, `@/hooks` etc. are configured in `tsconfig.json`.

## Testing

Tests use Vitest with `jsdom` environment and React Testing Library (see `vitest.config.mts`). Test files live alongside source in `__tests__` directories. Key coverage: `VirtualFileSystem` (`src/lib/__tests__/file-system.test.ts`), the JSX transformer, and both React contexts.
