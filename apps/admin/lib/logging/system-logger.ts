/**
 * System Admin Logger
 *
 * Centralized error and event logging for system administrators
 * Captures critical errors, performance issues, and system events
 */

import { prisma } from "@/lib/prisma";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  CRITICAL = "CRITICAL"
}

export enum LogCategory {
  CURRICULUM = "CURRICULUM",
  AI_PROVIDER = "AI_PROVIDER",
  SPEC_PROCESSING = "SPEC_PROCESSING",
  PROMPT_COMPOSITION = "PROMPT_COMPOSITION",
  DATABASE = "DATABASE",
  API = "API",
  SYSTEM = "SYSTEM"
}

export interface SystemLogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  requestId?: string;
  userId?: string;
  callerId?: string;
  timestamp: Date;
}

/**
 * Log a system event or error
 */
export async function logSystemEvent(entry: Omit<SystemLogEntry, 'timestamp'>): Promise<void> {
  const timestamp = new Date();

  // Console log for immediate visibility
  const prefix = `[${entry.level}] [${entry.category}]`;
  const contextStr = entry.context ? `\nContext: ${JSON.stringify(entry.context, null, 2)}` : '';
  const errorStr = entry.error ? `\nError: ${entry.error.name}: ${entry.error.message}\nStack: ${entry.error.stack}` : '';

  switch (entry.level) {
    case LogLevel.ERROR:
    case LogLevel.CRITICAL:
      console.error(`${prefix} ${entry.message}${contextStr}${errorStr}`);
      break;
    case LogLevel.WARN:
      console.warn(`${prefix} ${entry.message}${contextStr}`);
      break;
    default:
      console.log(`${prefix} ${entry.message}${contextStr}`);
  }

  // Store in database for admin dashboard
  try {
    await prisma.systemLog.create({
      data: {
        level: entry.level,
        category: entry.category,
        message: entry.message,
        context: entry.context as any || {},
        error: entry.error as any || null,
        requestId: entry.requestId,
        userId: entry.userId,
        callerId: entry.callerId,
        timestamp,
      },
    });
  } catch (dbError) {
    // If logging fails, at least console.error it
    console.error('[SYSTEM_LOGGER] Failed to write to database:', dbError);
  }

  // Send notifications for critical errors
  if (entry.level === LogLevel.CRITICAL) {
    await sendCriticalAlert(entry);
  }
}

/**
 * Helper to log errors with full context
 */
export async function logError(
  category: LogCategory,
  message: string,
  error: Error | any,
  context?: Record<string, any>
): Promise<void> {
  await logSystemEvent({
    level: LogLevel.ERROR,
    category,
    message,
    error: {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack,
    },
    context,
  });
}

/**
 * Helper to log critical errors that need immediate attention
 */
export async function logCritical(
  category: LogCategory,
  message: string,
  error: Error | any,
  context?: Record<string, any>
): Promise<void> {
  await logSystemEvent({
    level: LogLevel.CRITICAL,
    category,
    message,
    error: {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack,
    },
    context,
  });
}

/**
 * Helper to log warnings
 */
export async function logWarning(
  category: LogCategory,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  await logSystemEvent({
    level: LogLevel.WARN,
    category,
    message,
    context,
  });
}

/**
 * Send critical alerts to admin channels
 */
async function sendCriticalAlert(entry: Omit<SystemLogEntry, 'timestamp'>): Promise<void> {
  // TODO: Implement notification channels
  // - Email to admin@example.com
  // - Slack webhook
  // - SMS for P0 incidents

  console.error('🚨 CRITICAL ALERT:', entry.message);

  // For now, just ensure it's in the console
  // In production, integrate with your notification service
}

/**
 * Express/Next.js middleware to add request context to logs
 */
export function createRequestLogger(requestId: string, userId?: string) {
  return {
    error: (category: LogCategory, message: string, error: Error | any, context?: Record<string, any>) =>
      logError(category, message, error, { ...context, requestId, userId }),

    critical: (category: LogCategory, message: string, error: Error | any, context?: Record<string, any>) =>
      logCritical(category, message, error, { ...context, requestId, userId }),

    warning: (category: LogCategory, message: string, context?: Record<string, any>) =>
      logWarning(category, message, { ...context, requestId, userId }),

    info: (category: LogCategory, message: string, context?: Record<string, any>) =>
      logSystemEvent({
        level: LogLevel.INFO,
        category,
        message,
        context: { ...context, requestId, userId },
      }),
  };
}

/**
 * Wrap async functions with error logging
 */
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  category: LogCategory,
  fnName: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError(
        category,
        `Error in ${fnName}`,
        error,
        { functionName: fnName, args: JSON.stringify(args).substring(0, 500) }
      );
      throw error;
    }
  }) as T;
}
