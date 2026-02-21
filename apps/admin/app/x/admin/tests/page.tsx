"use client";

import { useState, useEffect, useRef } from "react";

interface Test {
  project: string;
  file: string;
  suite: string;
  name: string;
  fullPath: string;
}

interface TestRun {
  runId: string;
  status: "running" | "completed" | "failed";
  output: string;
  duration: number;
  exitCode?: number;
}

interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export default function TestDashboardPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Test[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Run state
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [runOutput, setRunOutput] = useState<string>("");
  const outputRef = useRef<HTMLPreElement>(null);

  // Report state
  const [report, setReport] = useState<{
    hasReport: boolean;
    summary: ReportSummary | null;
    lastModified: string | null;
  } | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Selected filters
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Load tests on mount
  useEffect(() => {
    loadTests();
    loadReport();
  }, []);

  // Poll for run status
  useEffect(() => {
    if (!activeRun || activeRun.status !== "running") return;

    const startedAt = Date.now();
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes (tests can take a while)

    const interval = setInterval(async () => {
      if (Date.now() - startedAt > TIMEOUT_MS) {
        clearInterval(interval);
        setActiveRun((prev) =>
          prev ? { ...prev, status: "failed" as const } : prev
        );
        setRunOutput((prev) => prev + "\n\n--- Polling timed out after 5 minutes ---\n");
        return;
      }
      try {
        const res = await fetch(`/api/admin/tests/run?runId=${activeRun.runId}`);
        const data = await res.json();

        if (data.ok) {
          setRunOutput(data.output);
          setActiveRun({
            runId: data.runId,
            status: data.status,
            output: data.output,
            duration: data.duration,
            exitCode: data.exitCode,
          });

          // Auto-scroll output
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }

          // Stop polling when done
          if (data.status !== "running") {
            loadReport(); // Refresh report
          }
        }
      } catch (e) {
        console.error("Error polling run status:", e);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeRun?.runId, activeRun?.status]);

  async function loadTests() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tests/list");
      const data = await res.json();

      if (data.ok) {
        setTests(data.tests);
        setGrouped(data.grouped);
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadReport() {
    try {
      const res = await fetch("/api/admin/tests/report");
      const data = await res.json();

      if (data.ok) {
        setReport({
          hasReport: data.hasReport,
          summary: data.summary,
          lastModified: data.lastModified,
        });
      }
    } catch (e) {
      console.error("Error loading report:", e);
    }
  }

  async function runTests(options?: { file?: string; project?: string }) {
    try {
      setRunOutput("");
      setShowReport(false);

      const res = await fetch("/api/admin/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options || {}),
      });

      const data = await res.json();

      if (data.ok) {
        setActiveRun({
          runId: data.runId,
          status: "running",
          output: "",
          duration: 0,
        });
      } else {
        setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  // Get unique projects
  const projects = [...new Set(tests.map((t) => t.project))];

  // Filter tests
  const filteredTests =
    selectedProject === "all"
      ? tests
      : tests.filter((t) => t.project === selectedProject);

  const filteredGrouped: Record<string, Test[]> = {};
  for (const [file, fileTests] of Object.entries(grouped)) {
    const filtered =
      selectedProject === "all"
        ? fileTests
        : fileTests.filter((t) => t.project === selectedProject);
    if (filtered.length > 0) {
      filteredGrouped[file] = filtered;
    }
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">E2E Test Dashboard</h1>
          <p className="text-neutral-400 mt-1">
            {tests.length} tests across {Object.keys(grouped).length} files
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Run All Button */}
          <button
            onClick={() => runTests()}
            disabled={activeRun?.status === "running"}
            className="px-4 py-2 disabled:bg-neutral-700 rounded font-medium flex items-center gap-2"
            style={{ background: activeRun?.status === "running" ? undefined : "var(--terminal-success-text)" }}
          >
            {activeRun?.status === "running" ? (
              <>
                <span className="animate-spin">⟳</span> Running...
              </>
            ) : (
              <>▶ Run All Tests</>
            )}
          </button>

          {/* View Report Button */}
          {report?.hasReport && (
            <button
              onClick={() => setShowReport(!showReport)}
              className="px-4 py-2 rounded font-medium hover:opacity-90"
              style={{ background: "var(--terminal-info-text)" }}
            >
              {showReport ? "Hide Report" : "View Report"}
            </button>
          )}
        </div>
      </div>

      {/* Report Summary */}
      {report?.summary && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="text-3xl font-bold">{report.summary.total}</div>
            <div className="text-neutral-400 text-sm">Total Tests</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--terminal-success-bg)", border: "1px solid color-mix(in srgb, var(--terminal-success-text) 50%, transparent)" }}>
            <div className="text-3xl font-bold" style={{ color: "var(--terminal-success-text)" }}>
              {report.summary.passed}
            </div>
            <div className="text-sm" style={{ color: "color-mix(in srgb, var(--terminal-success-text) 70%, transparent)" }}>Passed</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--terminal-error-bg)", border: "1px solid color-mix(in srgb, var(--terminal-error-text) 50%, transparent)" }}>
            <div className="text-3xl font-bold" style={{ color: "var(--terminal-error-text)" }}>
              {report.summary.failed}
            </div>
            <div className="text-sm" style={{ color: "color-mix(in srgb, var(--terminal-error-text) 70%, transparent)" }}>Failed</div>
          </div>
          <div className="rounded-lg p-4" style={{ background: "var(--terminal-warning-bg)", border: "1px solid color-mix(in srgb, var(--terminal-warning-text) 50%, transparent)" }}>
            <div className="text-3xl font-bold" style={{ color: "var(--terminal-warning-text)" }}>
              {report.summary.skipped}
            </div>
            <div className="text-sm" style={{ color: "color-mix(in srgb, var(--terminal-warning-text) 70%, transparent)" }}>Skipped</div>
          </div>
          <div className="bg-neutral-800 rounded-lg p-4">
            <div className="text-3xl font-bold">
              {(report.summary.duration / 1000).toFixed(1)}s
            </div>
            <div className="text-neutral-400 text-sm">Duration</div>
          </div>
        </div>
      )}

      {/* Active Run Output */}
      {activeRun && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {activeRun.status === "running" && (
                <span className="animate-pulse" style={{ color: "var(--terminal-warning-text)" }}>●</span>
              )}
              {activeRun.status === "completed" && (
                <span style={{ color: "var(--terminal-success-text)" }}>●</span>
              )}
              {activeRun.status === "failed" && (
                <span style={{ color: "var(--terminal-error-text)" }}>●</span>
              )}
              Test Run
              <span className="text-neutral-500 text-sm font-normal">
                ({(activeRun.duration / 1000).toFixed(1)}s)
              </span>
            </h2>
            {activeRun.status !== "running" && (
              <button
                onClick={() => setActiveRun(null)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                Clear
              </button>
            )}
          </div>
          <pre
            ref={outputRef}
            className="bg-black rounded-lg p-4 text-sm font-mono overflow-auto max-h-80 text-neutral-300"
          >
            {runOutput || "Starting tests..."}
          </pre>
        </div>
      )}

      {/* Embedded Report */}
      {showReport && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Playwright Report</h2>
            <a
              href="/api/admin/tests/report/html"
              target="_blank"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--terminal-info-text)" }}
            >
              Open in new tab ↗
            </a>
          </div>
          <iframe
            src="/api/admin/tests/report/html"
            className="w-full h-[600px] rounded-lg border border-neutral-700 bg-white"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg p-4 mb-6" style={{ background: "var(--terminal-error-bg)", border: "1px solid color-mix(in srgb, var(--terminal-error-text) 50%, transparent)" }}>
          <div className="font-semibold" style={{ color: "var(--terminal-error-text)" }}>Error</div>
          <div style={{ color: "color-mix(in srgb, var(--terminal-error-text) 80%, white)" }}>{error}</div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-neutral-400">
          Loading tests...
        </div>
      )}

      {/* Test Files */}
      {!loading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Test Files</h2>

          {Object.entries(filteredGrouped).map(([file, fileTests]) => (
            <div
              key={file}
              className="bg-neutral-800 rounded-lg overflow-hidden"
            >
              {/* File Header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-700/50"
                onClick={() =>
                  setSelectedFile(selectedFile === file ? null : file)
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-neutral-500">
                    {selectedFile === file ? "▼" : "▶"}
                  </span>
                  <span className="font-medium">{file}</span>
                  <span className="text-neutral-500 text-sm">
                    ({fileTests.length} tests)
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    runTests({ file });
                  }}
                  disabled={activeRun?.status === "running"}
                  className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded text-sm"
                >
                  Run File
                </button>
              </div>

              {/* Expanded Tests */}
              {selectedFile === file && (
                <div className="border-t border-neutral-700">
                  {fileTests.map((test, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-4 py-2 hover:bg-neutral-700/30 border-b border-neutral-700/50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={
                            test.project === "authenticated"
                              ? { background: "var(--terminal-success-bg)", color: "var(--terminal-success-text)" }
                              : test.project === "mobile"
                              ? { background: "color-mix(in srgb, var(--terminal-purple-text) 20%, transparent)", color: "var(--terminal-purple-text)" }
                              : { background: "var(--border-dark)", color: "var(--text-muted)" }
                          }
                        >
                          {test.project}
                        </span>
                        <span className="text-neutral-300">
                          {test.suite && (
                            <span className="text-neutral-500">
                              {test.suite} ›{" "}
                            </span>
                          )}
                          {test.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={() => loadTests()}
          className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg shadow-lg"
        >
          ↻ Refresh List
        </button>
      </div>
    </div>
  );
}
