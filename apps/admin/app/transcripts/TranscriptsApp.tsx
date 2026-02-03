"use client";

import React, { useState, useEffect } from 'react';

interface TranscriptFile {
  id: string;
  filename: string;
  relativePath: string;
  path: string;
  sizeBytes: number;
  sizeMB: string;
  modifiedAt: string;
  callCount: number;
  date: string | null;
  type: string;
  status: string;
  fileHash: string;
  fileExt: string;
}

export default function TranscriptsApp() {
  const [files, setFiles] = useState<TranscriptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcriptsPath, setTranscriptsPath] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/transcripts?range=[0,999]');
      const path = res.headers.get('X-Transcripts-Path');
      if (path) setTranscriptsPath(path);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch transcripts');
      }

      const data = await res.json();
      setFiles(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  };

  const handleImport = async () => {
    const selectedFiles = files.filter((f) => selectedIds.has(f.id));
    if (selectedFiles.length === 0) {
      setImportResult({ ok: false, message: 'No files selected' });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/transcripts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePaths: selectedFiles.map((f) => f.path),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setImportResult({
          ok: true,
          message: `Imported ${data.callsImported} calls from ${data.filesProcessed} files (${data.created} new callers)`,
        });
        setSelectedIds(new Set());
        fetchFiles(); // Refresh to update status
      } else {
        setImportResult({ ok: false, message: data.error || 'Import failed' });
      }
    } catch (e: any) {
      setImportResult({ ok: false, message: e.message });
    } finally {
      setImporting(false);
    }
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Batch: '#3b82f6',
      Single: '#8b5cf6',
      Text: '#f59e0b',
      Unknown: '#6b7280',
    };
    return colors[type] || '#6b7280';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: '#f59e0b',
      PROCESSING: '#3b82f6',
      COMPLETED: '#10b981',
      FAILED: '#ef4444',
      Unprocessed: '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  const totalCalls = files.reduce((sum, f) => sum + f.callCount, 0);
  const selectedFiles = files.filter((f) => selectedIds.has(f.id));
  const selectedCalls = selectedFiles.reduce((sum, f) => sum + f.callCount, 0);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Transcripts</h1>
        <p style={{ color: '#6b7280', fontSize: 14 }}>
          Raw transcript files from disk. Select files and click Import to add calls to the database.
        </p>
        {transcriptsPath && (
          <p style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'monospace', marginTop: 4 }}>
            Path: {transcriptsPath}
          </p>
        )}
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={selectAll}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {selectedIds.size === files.length && files.length > 0 ? 'Deselect All' : 'Select All'}
        </button>

        <button
          onClick={handleImport}
          disabled={selectedIds.size === 0 || importing}
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            background: selectedIds.size > 0 ? '#4f46e5' : '#d1d5db',
            color: '#fff',
            cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {importing ? (
            <>Importing...</>
          ) : (
            <>
              Import Selected
              {selectedIds.size > 0 && (
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                  {selectedIds.size} files / {selectedCalls} calls
                </span>
              )}
            </>
          )}
        </button>

        <button
          onClick={fetchFiles}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #d1d5db',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Refresh
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ color: '#6b7280', fontSize: 13 }}>
          {files.length} files / {totalCalls.toLocaleString()} total calls
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 8,
            background: importResult.ok ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${importResult.ok ? '#bbf7d0' : '#fecaca'}`,
            color: importResult.ok ? '#166534' : '#991b1b',
            fontSize: 13,
          }}
        >
          {importResult.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          Loading transcript files...
        </div>
      )}

      {/* Empty State */}
      {!loading && files.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            background: '#f9fafb',
            borderRadius: 12,
            border: '2px dashed #e5e7eb',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>No transcript files found</div>
          <div style={{ color: '#6b7280', fontSize: 14 }}>
            Place JSON or TXT transcript files in the transcripts folder, or set HF_TRANSCRIPTS_PATH environment variable.
          </div>
        </div>
      )}

      {/* Files Table */}
      {!loading && files.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 40 }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === files.length && files.length > 0}
                    onChange={selectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>Filename</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 100 }}>Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 120 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 80 }}>Calls</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 100 }}>Size</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb', width: 180 }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => {
                const isSelected = selectedIds.has(file.id);
                const typeColor = getTypeColor(file.type);
                const statusColor = getStatusColor(file.status);

                return (
                  <tr
                    key={file.id}
                    onClick={() => toggleSelect(file.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? '#eef2ff' : 'transparent',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontWeight: 500 }}>{file.filename}</div>
                      {file.relativePath !== file.filename && (
                        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>
                          {file.relativePath}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          background: `${typeColor}20`,
                          color: typeColor,
                        }}
                      >
                        {file.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          background: `${statusColor}20`,
                          color: statusColor,
                        }}
                      >
                        {file.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 500 }}>
                      {file.callCount.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: '#6b7280' }}>
                      {file.sizeMB} MB
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6b7280' }}>
                      {new Date(file.modifiedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
