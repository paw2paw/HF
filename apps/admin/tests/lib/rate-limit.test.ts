import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimit, _clearAllForTesting } from "@/lib/rate-limit";

describe("lib/rate-limit", () => {
  beforeEach(() => {
    _clearAllForTesting();
  });

  it("allows first request", () => {
    const result = checkRateLimit("1.2.3.4", "test");
    expect(result.ok).toBe(true);
  });

  it("allows requests under the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("1.2.3.4", "test");
      expect(result.ok).toBe(true);
    }
  });

  it("blocks requests over the limit with 429", () => {
    // Exhaust the limit (5 allowed, 6th blocked)
    for (let i = 0; i < 5; i++) {
      checkRateLimit("1.2.3.4", "test");
    }

    const result = checkRateLimit("1.2.3.4", "test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.error.status).toBe(429);
    }
  });

  it("tracks different IPs independently", () => {
    // Exhaust limit for IP A
    for (let i = 0; i < 6; i++) {
      checkRateLimit("1.1.1.1", "test");
    }
    expect(checkRateLimit("1.1.1.1", "test").ok).toBe(false);

    // IP B should still be allowed
    expect(checkRateLimit("2.2.2.2", "test").ok).toBe(true);
  });

  it("tracks different keys independently", () => {
    // Exhaust limit for key A
    for (let i = 0; i < 6; i++) {
      checkRateLimit("1.1.1.1", "auth");
    }
    expect(checkRateLimit("1.1.1.1", "auth").ok).toBe(false);

    // Key B with same IP should still be allowed
    expect(checkRateLimit("1.1.1.1", "invite").ok).toBe(true);
  });

  it("resetRateLimit clears the counter", () => {
    // Use up some attempts
    for (let i = 0; i < 4; i++) {
      checkRateLimit("1.1.1.1", "test");
    }

    resetRateLimit("1.1.1.1", "test");

    // Should be allowed again (counter reset)
    const result = checkRateLimit("1.1.1.1", "test");
    expect(result.ok).toBe(true);
  });

  it("returns Retry-After header in 429 response", async () => {
    for (let i = 0; i < 6; i++) {
      checkRateLimit("1.1.1.1", "test");
    }

    const result = checkRateLimit("1.1.1.1", "test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.error.json();
      expect(body.error).toContain("Too many attempts");
      expect(result.error.headers.get("Retry-After")).toBeTruthy();
    }
  });
});
