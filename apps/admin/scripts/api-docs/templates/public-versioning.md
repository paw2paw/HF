## Versioning

### URL versioning

The public API uses URL-based versioning:

```
https://api.hf.app/api/v1/callers
https://api.hf.app/api/v1/calls
```

The current stable version is **v1**. All examples in this document use v1.

### Stability guarantees

Within a major version:

- Existing fields are never removed or renamed.
- New optional fields may be added to responses.
- New optional query parameters may be added.
- Error codes and their meanings remain stable.

### Deprecation policy

When a breaking change is necessary:

1. The new version is released alongside the old one (e.g., v1 and v2).
2. The old version enters a **12-month deprecation window**.
3. Deprecated endpoints return a `Deprecation` header with the sunset date.
4. Email notifications are sent at 6 months, 3 months, and 1 month before sunset.

```
Deprecation: Sun, 01 Feb 2027 00:00:00 GMT
Sunset: Sun, 01 Feb 2027 00:00:00 GMT
Link: <https://docs.hf.app/api/v2/migration>; rel="successor-version"
```

### Beta endpoints

Endpoints marked as **beta** may change without a version bump. They are
indicated with a `X-HF-Beta: true` response header. Do not rely on beta
endpoints for production workflows without acknowledging this risk.
