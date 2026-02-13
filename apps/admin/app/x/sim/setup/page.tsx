"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface DomainOption {
  id: string;
  name: string;
  description: string | null;
  slug: string;
}

export default function SimSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const createCaller = useCallback(
    async (domainId: string) => {
      setSubmitting(true);
      setError(null);

      try {
        const res = await fetch("/api/sim/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domainId }),
        });

        const data = await res.json();

        if (data.ok) {
          router.push("/x/sim");
        } else {
          setError(data.error || "Failed to set up your profile.");
          setSubmitting(false);
        }
      } catch {
        setError("Something went wrong. Please try again.");
        setSubmitting(false);
      }
    },
    [router]
  );

  useEffect(() => {
    fetch("/api/sim/setup-info")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "Failed to load setup info.");
          setLoading(false);
          return;
        }

        if (data.assignedDomainId) {
          // Domain-locked tester: auto-create caller
          createCaller(data.assignedDomainId);
        } else {
          // Domain-chooser: show picker
          setDomains(data.domains || []);
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Failed to load setup info.");
        setLoading(false);
      });
  }, [createCaller]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDomainId) {
      createCaller(selectedDomainId);
    }
  };

  // Loading / auto-setup
  if (loading || submitting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex items-center gap-3 text-neutral-400">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Setting up your profile...
        </div>
      </div>
    );
  }

  // Error
  if (error && domains.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 text-center shadow-xl backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-semibold text-white">Setup Error</h1>
          <p className="text-neutral-400">{error}</p>
        </div>
      </div>
    );
  }

  // Domain picker
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white shadow-lg">
            HF
          </div>
          <h1 className="text-2xl font-semibold text-white">
            Choose Your Experience
          </h1>
          <p className="mt-2 text-neutral-400">
            Select which conversation type you&apos;d like to test
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-3">
              {domains.map((domain) => (
                <label
                  key={domain.id}
                  className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-all ${
                    selectedDomainId === domain.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-neutral-600 bg-neutral-700/30 hover:border-neutral-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="domain"
                    value={domain.id}
                    checked={selectedDomainId === domain.id}
                    onChange={(e) => setSelectedDomainId(e.target.value)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-white">
                      {domain.name}
                    </div>
                    {domain.description && (
                      <div className="mt-1 text-sm text-neutral-400">
                        {domain.description}
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedDomainId}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
