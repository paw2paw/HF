## Architecture Notes

### Middleware stack

All API routes pass through the following middleware chain:

1. **Rate limiter** -- Token-bucket per IP / API key
2. **Auth resolver** -- Extracts session cookie or Bearer token
3. **Scope checker** -- Validates API key scopes against endpoint requirements
4. **Request logger** -- Logs method, path, duration, status

### Prisma patterns

- Use `prisma.$transaction()` for multi-table writes.
- Prefer `include` over separate queries to avoid N+1.
- Use `select` when you only need a few fields.
- Never call `findMany()` without a `where` clause on large tables.

### Streaming responses

Pipeline and prompt-composition endpoints support streaming via
Server-Sent Events (SSE):

```typescript
// Return a streaming response
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  },
});
```

### Error handling conventions

All API routes follow the same pattern:

```typescript
try {
  // ... business logic
  return NextResponse.json({ ok: true, data });
} catch (error: any) {
  console.error("METHOD /api/path error:", error);
  return NextResponse.json(
    { ok: false, error: error?.message || "Operation failed" },
    { status: 500 }
  );
}
```

### Internal-only endpoints

Endpoints with `@auth internal` require the `x-internal-secret` header.
These are used for server-to-server communication (e.g., pipeline
orchestration between services) and are never exposed externally.
