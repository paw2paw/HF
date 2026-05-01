/**
 * Tests for channel capability registry (#235).
 */

import { describe, it, expect, vi } from "vitest";
import {
  channelSupportsRichMedia,
  resolveContentChannelFromSource,
} from "@/lib/channels/capabilities";

describe("channelSupportsRichMedia", () => {
  it("returns true for web-chat (browser rendering)", () => {
    expect(channelSupportsRichMedia("web-chat")).toBe(true);
  });

  it("returns true for whatsapp", () => {
    expect(channelSupportsRichMedia("whatsapp")).toBe(true);
  });

  it("returns true for email", () => {
    expect(channelSupportsRichMedia("email")).toBe(true);
  });

  it("returns false for voice (phone calls cannot render PDFs)", () => {
    expect(channelSupportsRichMedia("voice")).toBe(false);
  });

  it("returns false for sms (no rich media)", () => {
    expect(channelSupportsRichMedia("sms")).toBe(false);
  });

  it("returns false for unknown channel (safe-by-default)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(channelSupportsRichMedia("future-channel")).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns false for null/undefined", () => {
    expect(channelSupportsRichMedia(null)).toBe(false);
    expect(channelSupportsRichMedia(undefined)).toBe(false);
  });
});

describe("resolveContentChannelFromSource", () => {
  it("maps VAPI sources to voice", () => {
    expect(resolveContentChannelFromSource("VAPI")).toBe("voice");
    expect(resolveContentChannelFromSource("voice")).toBe("voice");
    expect(resolveContentChannelFromSource("phone")).toBe("voice");
  });

  it("maps sim sources to web-chat", () => {
    expect(resolveContentChannelFromSource("sim")).toBe("web-chat");
    expect(resolveContentChannelFromSource("ai-simulation")).toBe("web-chat");
    expect(resolveContentChannelFromSource("playground-upload")).toBe("web-chat");
  });

  it("maps whatsapp to whatsapp", () => {
    expect(resolveContentChannelFromSource("whatsapp")).toBe("whatsapp");
  });

  it("maps sms to sms", () => {
    expect(resolveContentChannelFromSource("sms")).toBe("sms");
  });

  it("returns null for unknown source", () => {
    expect(resolveContentChannelFromSource("import")).toBeNull();
    expect(resolveContentChannelFromSource("custom-thing")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(resolveContentChannelFromSource(null)).toBeNull();
    expect(resolveContentChannelFromSource(undefined)).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(resolveContentChannelFromSource("vapi")).toBe("voice");
    expect(resolveContentChannelFromSource("VAPI")).toBe("voice");
  });
});
