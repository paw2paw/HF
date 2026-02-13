/**
 * Tests for AIModelBadge component
 *
 * @feature AI Model Badge Display
 * @scenario Display AI model information in UI
 *
 * Gherkin:
 *   Feature: AI Model Badge Display
 *     As a user
 *     I want to see which AI model is being used
 *     So that I understand which model generated the response
 *
 *     Scenario: Display badge variant
 *       Given an AI endpoint with callPoint "spec.assistant"
 *       When the AIModelBadge component renders
 *       Then I should see the provider, model, and version
 *       And it should display as a badge with icon
 *
 *     Scenario: Display text variant
 *       Given an AI endpoint with callPoint "chat.data"
 *       When the AIModelBadge renders with variant="text"
 *       Then I should see the model info as plain text
 *       And it should be styled as secondary text
 *
 *     Scenario: Extract version from model name
 *       Given a model name "claude-sonnet-4.5"
 *       When the component processes the model name
 *       Then it should extract version "4.5"
 *       And display "Claude | claude-sonnet-4.5 | v4.5"
 *
 *     Scenario: Handle model without version
 *       Given a model name "gpt-4-turbo"
 *       When the component processes the model name
 *       Then it should not show a version suffix
 *
 *     Scenario: Loading state
 *       Given the AI config API is slow to respond
 *       When the component is fetching data
 *       Then I should see "Loading AI info..."
 *
 *     Scenario: API failure
 *       Given the AI config API returns an error
 *       When the component tries to fetch config
 *       Then it should handle the error gracefully
 *       And not display anything (return null)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AIModelBadge } from "../AIModelBadge";

// Mock fetch globally
global.fetch = vi.fn();

describe("AIModelBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Badge variant", () => {
    it("should display provider, model, and version in badge format", async () => {
      // Given: AI config API returns model info
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When: Rendering AIModelBadge
      render(<AIModelBadge callPoint="spec.assistant" variant="badge" />);

      // Then: Should show loading state first
      expect(screen.getByText(/Loading AI info/i)).toBeInTheDocument();

      // And: Should display model info after loading
      await waitFor(() => {
        expect(screen.getByText(/Claude \| claude-sonnet-4\.5 \| v4\.5/)).toBeInTheDocument();
      });

      // And: Should have badge styling (check for emoji icon)
      expect(screen.getByText("🤖")).toBeInTheDocument();
    });

    it("should use small size by default", async () => {
      // Given
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When
      const { container } = render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should apply small size styling
      await waitFor(() => {
        const badge = container.querySelector("span[title]");
        expect(badge).toBeInTheDocument();
      });
    });

    it("should support medium size", async () => {
      // Given
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When
      render(<AIModelBadge callPoint="spec.assistant" size="md" />);

      // Then: Should render with medium size
      await waitFor(() => {
        expect(screen.getByText(/Claude/)).toBeInTheDocument();
      });
    });
  });

  describe("Text variant", () => {
    it("should display model info as plain text", async () => {
      // Given
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "chat.data",
              provider: "openai",
              model: "gpt-4-turbo",
            },
          ],
        }),
      });

      // When
      render(<AIModelBadge callPoint="chat.data" variant="text" />);

      // Then: Should display as text without badge styling
      await waitFor(() => {
        expect(screen.getByText(/Openai \| gpt-4-turbo/)).toBeInTheDocument();
      });

      // And: Should not have badge emoji
      expect(screen.queryByText("🤖")).not.toBeInTheDocument();
    });
  });

  describe("Version extraction", () => {
    it("should extract version from model name with digits", async () => {
      // Given: Model name ends with version number
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When
      render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should extract and display version
      await waitFor(() => {
        expect(screen.getByText(/v4\.5/)).toBeInTheDocument();
      });
    });

    it("should not show version for models without numeric suffix", async () => {
      // Given: Model name doesn't end with version
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "openai",
              model: "gpt-4-turbo",
            },
          ],
        }),
      });

      // When
      render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should not show version suffix
      await waitFor(() => {
        const text = screen.getByText(/Openai \| gpt-4-turbo/);
        expect(text).toBeInTheDocument();
        expect(text.textContent).not.toContain(" | v");
      });
    });

    it("should handle model names with multiple hyphens", async () => {
      // Given: Complex model name
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-3-opus-20240229",
            },
          ],
        }),
      });

      // When
      render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should extract the last numeric part as version
      await waitFor(() => {
        expect(screen.getByText(/v20240229/)).toBeInTheDocument();
      });
    });
  });

  describe("Loading state", () => {
    it("should show loading message while fetching", () => {
      // Given: Slow API response
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      // When
      render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should show loading state
      expect(screen.getByText(/Loading AI info/i)).toBeInTheDocument();
    });

    it("should style loading message correctly", () => {
      // Given
      (global.fetch as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      // When
      const { container } = render(<AIModelBadge callPoint="spec.assistant" size="sm" />);

      // Then: Loading text should have appropriate styling
      const loadingSpan = screen.getByText(/Loading AI info/i);
      expect(loadingSpan).toBeInTheDocument();
      expect(loadingSpan.tagName).toBe("SPAN");
    });
  });

  describe("Error handling", () => {
    it("should handle API fetch errors gracefully", async () => {
      // Given: API returns error
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // When
      const { container } = render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should not crash and return null after error
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });

      // And: Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load AI config:",
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should return null when config not found for callPoint", async () => {
      // Given: API doesn't have config for this callPoint
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "other.endpoint",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When
      const { container } = render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should return null (no content)
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it("should handle malformed API response", async () => {
      // Given: API returns invalid data
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: false,
        }),
      });

      // When
      const { container } = render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should handle gracefully
      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe("Provider name formatting", () => {
    it("should capitalize provider name", async () => {
      // Given: Provider in lowercase
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "anthropic",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When
      render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should capitalize first letter
      await waitFor(() => {
        expect(screen.getByText(/Anthropic/)).toBeInTheDocument();
      });
    });
  });

  describe("Multiple callPoints", () => {
    it("should fetch config for different callPoints independently", async () => {
      // Given: Different configs for different callPoints
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
            {
              callPoint: "chat.data",
              provider: "openai",
              model: "gpt-4-turbo",
            },
          ],
        }),
      });

      // When: Rendering badge for spec.assistant
      render(<AIModelBadge callPoint="spec.assistant" />);

      // Then: Should show correct config
      await waitFor(() => {
        expect(screen.getByText(/Claude/)).toBeInTheDocument();
        expect(screen.queryByText(/Openai/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Re-fetching on callPoint change", () => {
    it("should refetch when callPoint prop changes", async () => {
      // Given: Initial config
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "spec.assistant",
              provider: "claude",
              model: "claude-sonnet-4.5",
            },
          ],
        }),
      });

      // When: Initial render
      const { rerender } = render(<AIModelBadge callPoint="spec.assistant" />);

      await waitFor(() => {
        expect(screen.getByText(/Claude/)).toBeInTheDocument();
      });

      // And: callPoint changes
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          ok: true,
          configs: [
            {
              callPoint: "chat.data",
              provider: "openai",
              model: "gpt-4-turbo",
            },
          ],
        }),
      });

      rerender(<AIModelBadge callPoint="chat.data" />);

      // Then: Should fetch and display new config
      await waitFor(() => {
        expect(screen.getByText(/Openai/)).toBeInTheDocument();
      });
    });
  });
});
