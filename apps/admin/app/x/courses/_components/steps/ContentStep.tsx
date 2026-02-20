'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Upload, AlertCircle } from 'lucide-react';
import type { StepProps } from '../CourseSetupWizard';

export function ContentStep({ setData, getData, onNext, onPrev }: StepProps) {
  const [uploadMode, setUploadMode] = useState<'file' | 'describe'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Load saved data
  useEffect(() => {
    const savedMode = getData<'file' | 'describe'>('contentMode');
    if (savedMode) setUploadMode(savedMode);
  }, [getData]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && ['application/pdf', 'text/plain', 'text/markdown'].includes(droppedFile.type)) {
      setFile(droppedFile);
    }
  };

  const handleNext = async () => {
    setData('contentMode', uploadMode);
    if (uploadMode === 'file' && file) {
      setData('contentFile', file);
    } else if (uploadMode === 'describe') {
      setData('contentDescription', description);
    }
    onNext();
  };

  const isValid = uploadMode === 'file' ? !!file : description.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Add Content</h1>
          <p className="text-[var(--text-secondary)]">Upload your curriculum or describe your course topics</p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-8 flex gap-4">
          <button
            onClick={() => setUploadMode('file')}
            className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
              uploadMode === 'file'
                ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
            }`}
          >
            <Upload className="w-5 h-5 mx-auto mb-2" />
            <h3 className="font-semibold">Upload File</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">PDF, TXT, or MD</p>
          </button>
          <button
            onClick={() => setUploadMode('describe')}
            className={`flex-1 p-4 rounded-lg border-2 text-center transition-all ${
              uploadMode === 'describe'
                ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-10'
                : 'border-[var(--border-default)] hover:border-[var(--border-subtle)]'
            }`}
          >
            <span className="text-2xl block mb-2">✍️</span>
            <h3 className="font-semibold">Describe</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Write topics in text</p>
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
              className={`p-8 rounded-lg border-2 border-dashed text-center cursor-pointer transition-all ${
                dragOver ? 'border-[var(--accent)] bg-[var(--accent)] bg-opacity-5' : 'border-[var(--border-default)]'
              }`}
            >
              {file ? (
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{file.name}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    onClick={() => setFile(null)}
                    className="text-xs text-[var(--accent)] hover:underline mt-2"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                  <p className="font-semibold text-[var(--text-primary)]">Drag your file here</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">or click to select</p>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => e.currentTarget.files?.[0] && setFile(e.currentTarget.files[0])}
                className="hidden"
              />
            </div>
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
              className="w-full px-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        )}
      </div>

      <div className="p-6 border-t border-[var(--border-default)] bg-[var(--surface-secondary)] flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!isValid}
          className="flex items-center gap-2 px-6 py-2 bg-[var(--accent)] text-white rounded-lg disabled:opacity-50"
        >
          Next <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
