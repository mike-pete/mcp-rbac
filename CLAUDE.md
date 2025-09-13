# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Gateway - A Model Context Protocol gateway that allows users to connect to multiple MCP servers through a single authenticated endpoint. Users connect to our MCP server via streamable HTTP, and we act as an MCP client connecting to other HTTP and SSE MCP servers.

## Development Commands

```bash
# Install dependencies
bun install

# Development server with Turbopack
bun dev
npm run dev

# Build production
bun run build
npm run build

# Start production server
bun start
npm start

# Lint code
bun run lint
npm run lint

# Test MCP server with inspector
bun mcp:inspect
npm run mcp:inspect

# Initialize/sync Convex database
npx convex dev
```

## Architecture Overview

### Core Components

**MCP Gateway System:**
- `src/mcp/streaming-server.ts` - Main MCP server implementation using @modelcontextprotocol/sdk
- `src/mcp/gateway-manager.ts` - Manages multiple upstream MCP server connections
- `src/mcp/upstream-client.ts` - HTTP/SSE client for connecting to upstream MCP servers
- `src/app/api/mcp/route.ts` - Next.js API route exposing MCP over HTTP

**User Management:**
- WorkOS AuthKit for authentication (`@workos-inc/authkit-nextjs`)
- `src/middleware/mcp-auth.ts` - Authentication middleware for MCP requests
- User context flows through to determine which MCP servers to load

**Database (Convex):**
- `convex/schema.ts` - Database schema defining `mcpServers` table
- `convex/mcpServers.ts` - CRUD operations for user's MCP server configurations
- `src/lib/convex-client.ts` - Server-side Convex client

**Dashboard UI:**
- `src/app/dashboard/page.tsx` - React interface for managing MCP servers
- `src/app/providers.tsx` - Convex React provider setup

### Request Flow

1. User authenticates via WorkOS
2. MCP client connects to `/api/mcp` endpoint
3. `mcp-auth.ts` validates authentication and extracts user context
4. `streaming-server.ts` fetches user's configured servers from Convex
5. `gateway-manager.ts` initializes connections to user's upstream MCP servers
6. Tool calls are routed to appropriate upstream servers or handled locally

### Key Patterns

**No Caching:** The system fetches user servers fresh on every MCP request for simplicity and consistency.

**Tool Namespacing:** Tools from upstream servers are prefixed with server names (e.g., `context7_resolve-library-id`).

**Per-User Isolation:** Each user has their own private set of MCP servers stored in Convex.

## Development Guidelines

- Always access environment variables via `src/env.ts` (import { env } from '@/env')
- Use `type` over `interface` in TypeScript
- Never use `any` in TypeScript - type strictly with discriminated unions when needed
- Prefer colocation and locality of behavior
- Never use CSS margin - use padding or layout techniques (flexbox/grid)
- Always style components for dark mode
- Always update `env.ts` when adding or updating environment variables
- Don't overengineer - build the simplest version possible

## Environment Variables

Managed through `src/env.ts` with Zod validation:
- Server-side: WorkOS keys, optional Context7 URL for testing
- Client-side: WorkOS redirect URI, Convex URL

## Testing MCP Server

Use MCP Inspector to test the server locally:
```bash
bun mcp:inspect
```
This connects to `http://localhost:3000/api/mcp` as configured in `mcp-inspector.json`.
- use tailwind neutral for darkmode colors
- use red as a secondary color, but prefer lighter shades of red like red-300 so it looks more pink
- don't disable eslint rules, fix your code instead