/**
 * Pipeline logger — in-memory structured log collector.
 * Used by pipeline stages to accumulate logs returned in the API response.
 */

export type LogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: any;
};

export type PipelineLogger = ReturnType<typeof createLogger>;

export function createLogger() {
  const logs: LogEntry[] = [];
  const startTime = Date.now();

  return {
    info: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "info", message, data });
    },
    warn: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "warn", message, data });
    },
    error: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "error", message, data });
    },
    debug: (message: string, data?: any) => {
      logs.push({ timestamp: new Date().toISOString(), level: "debug", message, data });
    },
    getLogs: () => logs,
    getDuration: () => Date.now() - startTime,
  };
}
