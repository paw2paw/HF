import { NextResponse } from 'next/server';
import { DEFAULT_SETTINGS_LIBRARY } from '@/lib/settings/library-schema';
import {
  loadSettingsLibrary,
  saveSettingsLibrary,
  getSettingsLibraryPath,
} from '@/lib/settings/resolver';
import {
  getHistoryPath,
  saveVersion,
  listVersions,
  getVersion,
  revertToVersion,
  compareVersions,
} from '@/lib/settings/history';
import path from 'node:path';
import os from 'node:os';

export const runtime = 'nodejs';

function assertLocalOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Settings library API is disabled in production');
  }
  if (process.env.HF_OPS_ENABLED !== 'true') {
    throw new Error('Settings library API is disabled (set HF_OPS_ENABLED=true in .env.local)');
  }
}

function expandTilde(p: string): string {
  const t = (p || '').trim();
  if (!t) return '';
  if (t === '~') return os.homedir();
  if (t.startsWith('~/') || t.startsWith('~\\')) {
    return path.join(os.homedir(), t.slice(2));
  }
  return t;
}

function kbRootFromEnv(): string {
  const envRaw = typeof process.env.HF_KB_PATH === 'string' ? process.env.HF_KB_PATH : '';
  const env = expandTilde(envRaw);
  if (env && env.trim()) return path.resolve(env.trim());
  return path.resolve(path.join(os.homedir(), 'hf_kb'));
}

/**
 * GET /api/settings-library
 *
 * Returns the settings library (or default if file doesn't exist)
 * Query params:
 * - version: Get a specific version from history
 * - history: Get version history (limit param optional)
 * - compare: Compare two versions (requires from & to params)
 */
export async function GET(req: Request) {
  try {
    assertLocalOnly();

    const kbRoot = kbRootFromEnv();
    const libraryPath = getSettingsLibraryPath(kbRoot);
    const historyPath = getHistoryPath(kbRoot);

    const url = new URL(req.url);
    const versionParam = url.searchParams.get('version');
    const historyParam = url.searchParams.get('history');
    const compareParam = url.searchParams.get('compare');
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');
    const limitParam = url.searchParams.get('limit');

    // Get specific version
    if (versionParam) {
      const version = parseInt(versionParam, 10);
      const versionData = await getVersion(historyPath, version);

      if (!versionData) {
        return NextResponse.json(
          { ok: false, error: `Version ${version} not found` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        version: versionData,
      });
    }

    // Get version history
    if (historyParam === 'true') {
      const limit = limitParam ? parseInt(limitParam, 10) : undefined;
      const versions = await listVersions(historyPath, limit);

      return NextResponse.json({
        ok: true,
        versions,
        total: versions.length,
      });
    }

    // Compare versions
    if (compareParam === 'true' && fromParam && toParam) {
      const from = parseInt(fromParam, 10);
      const to = parseInt(toParam, 10);
      const diffs = await compareVersions(historyPath, from, to);

      return NextResponse.json({
        ok: true,
        from,
        to,
        diffs,
      });
    }

    // Default: Get current library
    let library = await loadSettingsLibrary(libraryPath);

    if (!library) {
      // Return default library if file doesn't exist
      library = DEFAULT_SETTINGS_LIBRARY;
    }

    return NextResponse.json({
      ok: true,
      library,
      meta: {
        path: libraryPath,
        historyPath,
        exists: !!(await loadSettingsLibrary(libraryPath)),
        kbRoot,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to load settings library' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings-library
 *
 * Save settings library (automatically saves version to history)
 */
export async function POST(req: Request) {
  try {
    assertLocalOnly();

    const kbRoot = kbRootFromEnv();
    const libraryPath = getSettingsLibraryPath(kbRoot);
    const historyPath = getHistoryPath(kbRoot);

    const body = await req.json();

    if (!body.library || typeof body.library !== 'object') {
      throw new Error('Invalid request: library object required');
    }

    // Save the library
    await saveSettingsLibrary(libraryPath, body.library);

    // Save version to history
    const versionNumber = await saveVersion(historyPath, body.library, {
      source: body.source || 'ui',
      user: body.user,
      note: body.note,
    });

    return NextResponse.json({
      ok: true,
      library: body.library,
      version: versionNumber,
      meta: {
        path: libraryPath,
        historyPath,
        kbRoot,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to save settings library' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings-library
 *
 * Initialize settings library with defaults (if it doesn't exist)
 */
export async function PUT() {
  try {
    assertLocalOnly();

    const kbRoot = kbRootFromEnv();
    const libraryPath = getSettingsLibraryPath(kbRoot);
    const historyPath = getHistoryPath(kbRoot);

    const existing = await loadSettingsLibrary(libraryPath);

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: 'Settings library already exists',
        library: existing,
        meta: {
          path: libraryPath,
          historyPath,
          kbRoot,
        },
      });
    }

    await saveSettingsLibrary(libraryPath, DEFAULT_SETTINGS_LIBRARY);

    // Save initial version to history
    const versionNumber = await saveVersion(historyPath, DEFAULT_SETTINGS_LIBRARY, {
      source: 'init',
      note: 'Initial library creation with defaults',
    });

    return NextResponse.json({
      ok: true,
      message: 'Settings library initialized with defaults',
      library: DEFAULT_SETTINGS_LIBRARY,
      version: versionNumber,
      meta: {
        path: libraryPath,
        historyPath,
        kbRoot,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to initialize settings library' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings-library
 *
 * Revert to a specific version
 */
export async function PATCH(req: Request) {
  try {
    assertLocalOnly();

    const kbRoot = kbRootFromEnv();
    const libraryPath = getSettingsLibraryPath(kbRoot);
    const historyPath = getHistoryPath(kbRoot);

    const body = await req.json();

    if (!body.version || typeof body.version !== 'number') {
      throw new Error('Invalid request: version number required');
    }

    const revertedLibrary = await revertToVersion(
      historyPath,
      libraryPath,
      body.version
    );

    if (!revertedLibrary) {
      return NextResponse.json(
        { ok: false, error: `Version ${body.version} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      library: revertedLibrary,
      message: `Reverted to version ${body.version}`,
      meta: {
        path: libraryPath,
        historyPath,
        kbRoot,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to revert settings library' },
      { status: 500 }
    );
  }
}
