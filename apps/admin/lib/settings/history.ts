/**
 * Settings Library Version History
 *
 * Tracks changes to the settings library over time, enabling:
 * - Audit trail (who changed what, when)
 * - Revert to previous versions
 * - Diff between versions
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { SettingsLibrary } from './library-schema';

export interface SettingsLibraryVersion {
  version: number;
  timestamp: string;
  library: SettingsLibrary;
  metadata: {
    source?: string; // 'ui', 'api', 'script', etc.
    user?: string;
    note?: string;
  };
}

export interface SettingsLibraryHistory {
  currentVersion: number;
  versions: SettingsLibraryVersion[];
}

/**
 * Get history file path
 */
export function getHistoryPath(kbRoot: string): string {
  return path.join(kbRoot, '.hf', 'settings-library-history.json');
}

/**
 * Load history
 */
export async function loadHistory(historyPath: string): Promise<SettingsLibraryHistory | null> {
  try {
    const content = await fs.readFile(historyPath, 'utf-8');
    return JSON.parse(content) as SettingsLibraryHistory;
  } catch {
    return null;
  }
}

/**
 * Save a new version to history
 */
export async function saveVersion(
  historyPath: string,
  library: SettingsLibrary,
  metadata: SettingsLibraryVersion['metadata'] = {}
): Promise<number> {
  const history = (await loadHistory(historyPath)) || {
    currentVersion: 0,
    versions: [],
  };

  const newVersion = history.currentVersion + 1;

  const versionEntry: SettingsLibraryVersion = {
    version: newVersion,
    timestamp: new Date().toISOString(),
    library,
    metadata,
  };

  history.versions.push(versionEntry);
  history.currentVersion = newVersion;

  // Keep only last 50 versions to prevent file bloat
  if (history.versions.length > 50) {
    history.versions = history.versions.slice(-50);
  }

  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');

  return newVersion;
}

/**
 * Get a specific version
 */
export async function getVersion(
  historyPath: string,
  version: number
): Promise<SettingsLibraryVersion | null> {
  const history = await loadHistory(historyPath);
  if (!history) return null;

  return history.versions.find((v) => v.version === version) || null;
}

/**
 * Get latest version
 */
export async function getLatestVersion(
  historyPath: string
): Promise<SettingsLibraryVersion | null> {
  const history = await loadHistory(historyPath);
  if (!history || history.versions.length === 0) return null;

  return history.versions[history.versions.length - 1];
}

/**
 * List all versions (newest first)
 */
export async function listVersions(
  historyPath: string,
  limit?: number
): Promise<SettingsLibraryVersion[]> {
  const history = await loadHistory(historyPath);
  if (!history) return [];

  const sorted = [...history.versions].reverse();
  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Revert to a specific version
 */
export async function revertToVersion(
  historyPath: string,
  libraryPath: string,
  version: number
): Promise<SettingsLibrary | null> {
  const targetVersion = await getVersion(historyPath, version);
  if (!targetVersion) return null;

  // Save current state as a new version with revert metadata
  const currentLibrary = await loadCurrentLibrary(libraryPath);
  if (currentLibrary) {
    await saveVersion(historyPath, currentLibrary, {
      source: 'revert',
      note: `Before reverting to version ${version}`,
    });
  }

  // Write the reverted library
  await fs.writeFile(
    libraryPath,
    JSON.stringify(
      {
        ...targetVersion.library,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf-8'
  );

  // Save the revert as a new version
  await saveVersion(historyPath, targetVersion.library, {
    source: 'revert',
    note: `Reverted to version ${version}`,
  });

  return targetVersion.library;
}

/**
 * Compare two versions
 */
export interface SettingDiff {
  key: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldValue?: any;
  newValue?: any;
}

export async function compareVersions(
  historyPath: string,
  fromVersion: number,
  toVersion: number
): Promise<SettingDiff[]> {
  const from = await getVersion(historyPath, fromVersion);
  const to = await getVersion(historyPath, toVersion);

  if (!from || !to) return [];

  const diffs: SettingDiff[] = [];
  const allKeys = new Set([
    ...Object.keys(from.library.settings || {}),
    ...Object.keys(to.library.settings || {}),
  ]);

  for (const key of allKeys) {
    const oldSetting = from.library.settings?.[key];
    const newSetting = to.library.settings?.[key];

    if (!oldSetting && newSetting) {
      diffs.push({
        key,
        type: 'added',
        newValue: newSetting,
      });
    } else if (oldSetting && !newSetting) {
      diffs.push({
        key,
        type: 'removed',
        oldValue: oldSetting,
      });
    } else if (oldSetting && newSetting) {
      const hasChanges = JSON.stringify(oldSetting) !== JSON.stringify(newSetting);
      diffs.push({
        key,
        type: hasChanges ? 'modified' : 'unchanged',
        oldValue: oldSetting,
        newValue: newSetting,
      });
    }
  }

  return diffs;
}

/**
 * Helper: Load current library from file
 */
async function loadCurrentLibrary(libraryPath: string): Promise<SettingsLibrary | null> {
  try {
    const content = await fs.readFile(libraryPath, 'utf-8');
    return JSON.parse(content) as SettingsLibrary;
  } catch {
    return null;
  }
}
