'use client';

import { useState, useEffect } from 'react';
import {
  SettingsLibrary,
  SettingDefinition,
  DEFAULT_SETTINGS_LIBRARY,
} from '@/lib/settings/library-schema';
import { DraggableTabs } from "@/components/shared/DraggableTabs";

export default function SettingsLibraryPage() {
  const [library, setLibrary] = useState<SettingsLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [libraryPath, setLibraryPath] = useState<string>('');
  const [libraryExists, setLibraryExists] = useState(false);

  // Filter/search state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // History state
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadLibrary();
  }, []);

  async function loadLibrary() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/settings-library');
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load settings library');
      }

      setLibrary(data.library);
      setLibraryPath(data.meta.path);
      setLibraryExists(data.meta.exists);
    } catch (err: any) {
      setError(err.message);
      setLibrary(null);
    } finally {
      setLoading(false);
    }
  }

  async function initializeLibrary() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings-library', { method: 'PUT' });
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to initialize library');
      }

      setSuccess('Settings library initialized with defaults');
      await loadLibrary();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveLibrary() {
    if (!library) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ library, source: 'ui' }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to save library');
      }

      setSuccess(`Settings library saved successfully (version ${data.version})`);
      await loadLibrary();
      if (activeTab === 'history') {
        await loadHistory();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    setError(null);

    try {
      const res = await fetch('/api/settings-library?history=true&limit=20');
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to load history');
      }

      setVersions(data.versions || []);
    } catch (err: any) {
      setError(err.message);
      setVersions([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function revertToVersion(version: number) {
    if (!confirm(`Revert to version ${version}? Current changes will be saved as a new version.`)) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings-library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to revert');
      }

      setSuccess(data.message);
      await loadLibrary();
      await loadHistory();
      setActiveTab('settings');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'history' && versions.length === 0) {
      loadHistory();
    }
  }, [activeTab]);

  function updateSetting(key: string, updates: Partial<SettingDefinition>) {
    if (!library) return;

    setLibrary({
      ...library,
      settings: {
        ...library.settings,
        [key]: {
          ...library.settings[key],
          ...updates,
        } as SettingDefinition,
      },
    });
  }

  function deleteSetting(key: string) {
    if (!library) return;
    if (!confirm(`Delete setting "${key}"? This cannot be undone.`)) return;

    const { [key]: removed, ...rest } = library.settings;
    setLibrary({
      ...library,
      settings: rest,
    });
  }

  const categories = ['all', 'ingestion', 'embedding', 'paths', 'processing', 'batch', 'misc'];

  const filteredSettings = library
    ? Object.entries(library.settings).filter(([key, setting]) => {
        const matchesSearch =
          searchTerm === '' ||
          key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          setting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          setting.description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory =
          categoryFilter === 'all' || setting.category === categoryFilter;

        return matchesSearch && matchesCategory;
      })
    : [];

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-sm text-neutral-600">Loading settings library...</div>
      </div>
    );
  }

  if (!library && !libraryExists) {
    return (
      <div className="p-8">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Settings Library</h1>
          <p className="text-sm text-neutral-600 mb-6">
            The settings library provides reusable field definitions that agents can reference.
          </p>

          <div className="rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <div className="text-sm font-medium text-neutral-800 mb-2">
              No settings library found
            </div>
            <div className="text-xs text-neutral-600 mb-4">
              Initialize the library with default settings to get started.
            </div>
            <button
              onClick={initializeLibrary}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Initializing...' : 'Initialize Library'}
            </button>
            {error && (
              <div className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            <strong>Path:</strong> {libraryPath}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">Settings Library</h1>
          <p className="text-sm text-neutral-600 mb-4">
            Reusable field definitions that agents can reference using <code className="text-xs bg-neutral-100 px-1 py-0.5 rounded">$ref</code>.
          </p>

          {/* Tabs */}
          <DraggableTabs
            storageKey="settings-library-tabs"
            tabs={[
              { id: "settings", label: "Settings" },
              { id: "history", label: "Version History" },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as "settings" | "history")}
            containerStyle={{ marginBottom: 16 }}
          />

          {error && (
            <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 text-xs text-green-600 bg-green-50 border border-green-200 rounded-md p-3">
              {success}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search settings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            <button
              onClick={saveLibrary}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Library'}
            </button>
          </div>

          <div className="mt-2 text-xs text-neutral-500">
            <strong>Path:</strong> {libraryPath} • <strong>Settings:</strong> {Object.keys(library?.settings || {}).length}
          </div>
        </div>

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            {filteredSettings.length === 0 && (
              <div className="text-center py-12 text-sm text-neutral-500">
                No settings found matching your search.
              </div>
            )}

            {filteredSettings.map(([key, setting]) => (
              <SettingCard
                key={key}
                settingKey={key}
                setting={setting}
                onUpdate={(updates) => updateSetting(key, updates)}
                onDelete={() => deleteSetting(key)}
              />
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {loadingHistory && (
              <div className="text-center py-12 text-sm text-neutral-600">
                Loading version history...
              </div>
            )}

            {!loadingHistory && versions.length === 0 && (
              <div className="text-center py-12 text-sm text-neutral-500">
                No version history yet. Save the library to create the first version.
              </div>
            )}

            {!loadingHistory && versions.length > 0 && (
              <div className="space-y-3">
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="border border-neutral-200 rounded-lg bg-white p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-neutral-900">
                            Version {v.version}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
                            {v.metadata?.source || 'unknown'}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-600">
                          {new Date(v.timestamp).toLocaleString()}
                        </div>
                        {v.metadata?.note && (
                          <div className="text-xs text-neutral-700 mt-2">
                            {v.metadata.note}
                          </div>
                        )}
                        <div className="text-xs text-neutral-500 mt-1">
                          {Object.keys(v.library.settings || {}).length} settings
                        </div>
                      </div>

                      <button
                        onClick={() => revertToVersion(v.version)}
                        disabled={saving}
                        className="text-xs px-3 py-1.5 text-indigo-700 hover:bg-indigo-50 rounded border border-indigo-300 disabled:opacity-50"
                      >
                        Revert to this version
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingCard({
  settingKey,
  setting,
  onUpdate,
  onDelete,
}: {
  settingKey: string;
  setting: SettingDefinition;
  onUpdate: (updates: Partial<SettingDefinition>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-neutral-200 rounded-lg bg-white">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-sm font-mono font-medium text-neutral-900">{settingKey}</div>
            <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded">
              {setting.type}
            </span>
            {setting.category && (
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">
                {setting.category}
              </span>
            )}
          </div>
          <div className="text-sm font-medium text-neutral-800">{setting.title}</div>
          {setting.description && (
            <div className="text-xs text-neutral-600 mt-1">{setting.description}</div>
          )}
          {setting.tags && setting.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {setting.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 bg-neutral-50 text-neutral-500 rounded border border-neutral-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-3 py-1.5 text-neutral-700 hover:bg-neutral-50 rounded border border-neutral-300"
          >
            {expanded ? 'Collapse' : 'Edit'}
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-3 py-1.5 text-red-700 hover:bg-red-50 rounded border border-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                value={setting.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
              <select
                value={setting.category || 'misc'}
                onChange={(e) => onUpdate({ category: e.target.value as any })}
                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
              >
                <option value="ingestion">Ingestion</option>
                <option value="embedding">Embedding</option>
                <option value="paths">Paths</option>
                <option value="processing">Processing</option>
                <option value="batch">Batch</option>
                <option value="misc">Misc</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                value={setting.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
                rows={2}
              />
            </div>

            {/* Type-specific fields */}
            {setting.type === 'number' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Default</label>
                  <input
                    type="number"
                    value={setting.default}
                    onChange={(e) => onUpdate({ default: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Minimum</label>
                  <input
                    type="number"
                    value={setting.minimum ?? ''}
                    onChange={(e) => onUpdate({ minimum: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Maximum</label>
                  <input
                    type="number"
                    value={setting.maximum ?? ''}
                    onChange={(e) => onUpdate({ maximum: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
                  />
                </div>
              </>
            )}

            {setting.type === 'string' && (
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Default</label>
                <input
                  type="text"
                  value={setting.default}
                  onChange={(e) => onUpdate({ default: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
                />
              </div>
            )}

            {setting.type === 'boolean' && (
              <div>
                <label className="flex items-center gap-2 text-xs font-medium text-neutral-700">
                  <input
                    type="checkbox"
                    checked={setting.default}
                    onChange={(e) => onUpdate({ default: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  Default: {setting.default ? 'true' : 'false'}
                </label>
              </div>
            )}

            {setting.type === 'enum' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Enum Values (comma-separated)
                </label>
                <input
                  type="text"
                  value={setting.enum.join(', ')}
                  onChange={(e) =>
                    onUpdate({ enum: e.target.value.split(',').map((v) => v.trim()) })
                  }
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 rounded-md"
                />
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-neutral-200">
            <div className="text-xs font-medium text-neutral-700 mb-2">Usage in agents.json:</div>
            <pre className="text-xs bg-white border border-neutral-200 rounded-md p-2 overflow-x-auto">
              {JSON.stringify(
                {
                  settingsSchema: {
                    properties: {
                      myField: { $ref: `#/settings/${settingKey}` },
                    },
                  },
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
