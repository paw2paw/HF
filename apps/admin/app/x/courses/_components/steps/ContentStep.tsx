'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Upload, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function ContentStep({ setData, getData, onNext, onPrev }: StepProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'describe'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedSourceId, setUploadedSourceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore saved file name indicator from context
  const savedFileName = getData<string>('contentFileName');

  // Load saved data
  useEffect(() => {
    const savedMode = getData<'file' | 'describe'>('contentMode');
    if (savedMode) setUploadMode(savedMode);
    const savedDesc = getData<string>('contentDescription');
    if (savedDesc) setDescription(savedDesc);
    const savedSourceId = getData<string>('sourceId');
    if (savedSourceId) setUploadedSourceId(savedSourceId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && ['application/pdf', 'text/plain', 'text/markdown'].includes(droppedFile.type)) {
      setFile(droppedFile);
      // Clear old sourceId if user picks a different file
      if (uploadedSourceId) {
        setUploadedSourceId(null);
        setData('sourceId', undefined);
      }
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    // Clear old sourceId if user picks a different file
    if (uploadedSourceId) {
      setUploadedSourceId(null);
      setData('sourceId', undefined);
    }
  };

  const handleNext = async () => {
    setData('contentMode', uploadMode);

    if (uploadMode === 'file' && (file || uploadedSourceId)) {
      // Already uploaded on a previous visit — skip re-upload
      if (uploadedSourceId && !file) {
        onNext();
        return;
      }
      if (uploadedSourceId) {
        // Same step re-visit with sourceId already set, no new file
        onNext();
        return;
      }

      if (!file) return;

      setUploading(true);
      setUploadError(null);

      try {
        // Step 1: Create ContentSource metadata
        const slug = `course-upload-${Date.now()}`;
        const name = file.name.replace(/\.[^.]+$/, '');
        const createRes = await fetch('/api/content-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            name,
            description: 'Uploaded via Course Setup Wizard',
            trustLevel: 'UNVERIFIED',
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create content source');
        const sourceId = createData.source.id;

        // Step 2: Upload file + classify via existing Content Sources API
        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', 'classify');
        const importRes = await fetch(`/api/content-sources/${sourceId}/import`, {
          method: 'POST',
          body: formData,
        });
        const importData = await importRes.json();
        if (!importRes.ok) throw new Error(importData.error || 'File upload failed');

        // Store sourceId in flow bag
        setData('sourceId', sourceId);
        setData('contentFileName', file.name);
        setUploadedSourceId(sourceId);
        onNext();
      } catch (err: any) {
        setUploadError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    } else if (uploadMode === 'describe') {
      setData('contentDescription', description);
      onNext();
    }
  };

  const hasFile = !!file;
  const isValid = uploadMode === 'file' ? (hasFile || !!uploadedSourceId) : description.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Add Content</h1>
          <p className="text-[var(--text-secondary)]">Upload your curriculum or describe your course topics</p>
        </div>

        {/* Mode Toggle */}
        <div style={{ marginBottom: 32, display: "flex", gap: 16 }}>
          <button
            onClick={() => setUploadMode('file')}
            className={uploadMode === 'file' ? "hf-chip hf-chip-selected" : "hf-chip"}
            style={{ flex: 1, padding: 16, textAlign: "center", display: "block", borderRadius: 10, borderWidth: 2 }}
          >
            <Upload style={{ width: 20, height: 20, margin: "0 auto 8px" }} />
            <h3 style={{ fontWeight: 600 }}>Upload File</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>PDF, TXT, or MD</p>
          </button>
          <button
            onClick={() => setUploadMode('describe')}
            className={uploadMode === 'describe' ? "hf-chip hf-chip-selected" : "hf-chip"}
            style={{ flex: 1, padding: 16, textAlign: "center", display: "block", borderRadius: 10, borderWidth: 2 }}
          >
            <span style={{ fontSize: 24, display: "block", marginBottom: 8 }}>✍️</span>
            <h3 style={{ fontWeight: 600 }}>Describe</h3>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Write topics in text</p>
          </button>
        </div>

        {/* Upload File */}
        {uploadMode === 'file' && (
          <div className="mb-8">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`p-8 rounded-lg border-2 border-dashed text-center cursor-pointer transition-all ${
                dragOver ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-5' : 'border-[var(--border-default)]'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              {uploadedSourceId && !file ? (
                <div>
                  <CheckCircle className="w-5 h-5 text-[var(--status-success-text)] mx-auto mb-2" />
                  <p className="font-semibold text-[var(--text-primary)]">{savedFileName || 'File uploaded'}</p>
                  <p className="text-sm text-[var(--status-success-text)]">Uploaded and ready</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedSourceId(null);
                      setData('sourceId', undefined);
                    }}
                    className="text-xs text-[var(--accent)] hover:underline mt-2"
                  >
                    Choose different file
                  </button>
                </div>
              ) : file ? (
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{file.name}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-xs text-[var(--accent)] hover:underline mt-2"
                  >
                    Choose different file
                  </button>
                </div>
              ) : savedFileName && !uploadedSourceId ? (
                <div>
                  <AlertCircle className="w-5 h-5 text-[var(--status-warning-text)] mx-auto mb-2" />
                  <p className="font-semibold text-[var(--text-primary)]">{savedFileName}</p>
                  <p className="text-sm text-[var(--status-warning-text)]">File needs to be re-selected after page refresh</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Click to re-upload, or Skip this step</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                  <p className="font-semibold text-[var(--text-primary)]">Drag your file here</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">or click to select</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => e.currentTarget.files?.[0] && handleFileSelect(e.currentTarget.files[0])}
                className="hidden"
              />
            </div>

            {uploadError && (
              <div className="hf-banner hf-banner-error" style={{ marginTop: 12 }}>
                <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{uploadError}</span>
                <button
                  onClick={() => setUploadError(null)}
                  className="hf-btn-ghost"
                  style={{ padding: 0, fontSize: 12, color: "inherit", textDecoration: "underline" }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}

        {/* Describe Topics */}
        {uploadMode === 'describe' && (
          <div className="mb-8">
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              Describe your course topics
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., 'This course covers photosynthesis, cellular respiration, and ecology. Students should understand how plants convert sunlight to energy...'"
              rows={6}
              className="hf-input"
            />
          </div>
        )}
      </div>

      <div className="hf-step-footer">
        <button
          onClick={onPrev}
          className="hf-btn hf-btn-ghost"
          disabled={uploading}
        >
          Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => {
              setData('contentMode', 'skip');
              setData('contentFileName', undefined);
              setData('sourceId', undefined);
              onNext();
            }}
            className="hf-btn hf-btn-ghost"
            disabled={uploading}
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            disabled={!isValid || uploading}
            className="hf-btn hf-btn-primary"
          >
            {uploading ? (
              <>Uploading<div className="hf-spinner" style={{ width: 16, height: 16 }} /></>
            ) : (
              <>Next <ArrowRight style={{ width: 16, height: 16 }} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
