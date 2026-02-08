/**
 * @deprecated Use @/lib/logger instead
 *
 * This file re-exports from the unified logger for backwards compatibility.
 */

export {
  logAI as logAICall,
  logAI,
  isLoggingEnabled,
  setLoggingEnabled,
  getLogFilePath,
  logFullPrompt,
} from "./logger";
