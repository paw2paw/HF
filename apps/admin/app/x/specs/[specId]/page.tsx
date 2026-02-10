"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/src/components/shared/EntityPill";

interface AnalysisSpec {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  outputType: string;
  scope: string;
  specType: string;
  domain: string | null;
  isActive: boolean;
  isDirty: boolean;
  priority: number;
  config: any;
  promptTemplate: string | null;
  createdAt: string;
  updatedAt: string;
  triggers?: Array<{
    id: string;
    condition: string;
    actions: Array<{
      id: string;
      actionType: string;
      parameterId: string | null;
      description: string;
    }>;
  }>;
}

export default function SpecDetailPage() {
  const params = useParams();
  const router = useRouter();
  const specId = params.specId as string;

  const [spec, setSpec] = useState<AnalysisSpec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSpec() {
      try {
        const res = await fetch(`/api/specs/${specId}`);
        const data = await res.json();

        if (data.ok) {
          setSpec(data.spec);
        } else {
          setError(data.error || "Failed to load spec");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load spec");
      } finally {
        setLoading(false);
      }
    }

    if (specId) {
      fetchSpec();
    }
  }, [specId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 w-full bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !spec) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-white border border-red-300 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Error</h2>
          <p className="mb-4">{error || "Spec not found"}</p>
          <Link
            href="/x/specs"
            className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
          >
            ← Back to Specs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/x/specs"
            className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-gray-100 transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{spec.name}</h1>
            <p className="text-gray-500">{spec.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            onClick={() => alert("Edit functionality coming soon")}
          >
            ✏️ Edit
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            onClick={() => alert("JSON view coming soon")}
          >
            📄 View JSON
          </button>
          <button
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
            onClick={() => {
              if (confirm("Are you sure you want to delete this spec?")) {
                alert("Delete functionality coming soon");
              }
            }}
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* Overview */}
      <div className="bg-white border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Overview</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Output Type</p>
              <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {spec.outputType}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Scope</p>
              <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                {spec.scope}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Spec Type</p>
              <span className="inline-block px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                {spec.specType}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
              <StatusBadge
                status={spec.isActive ? "active" : "archived"}
                label={spec.isActive ? "Active" : "Inactive"}
                size="compact"
              />
            </div>
            {spec.domain && (
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Domain</p>
                <p className="text-sm">{spec.domain}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Priority</p>
              <p className="text-sm">{spec.priority}</p>
            </div>
          </div>

          {spec.description && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
              <p className="text-sm">{spec.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Prompt Template */}
      {spec.promptTemplate && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Prompt Template</h2>
          </div>
          <div className="p-6">
            <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto border">
              {spec.promptTemplate}
            </pre>
          </div>
        </div>
      )}

      {/* Triggers */}
      {spec.triggers && spec.triggers.length > 0 && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Triggers ({spec.triggers.length})</h2>
            <p className="text-sm text-gray-500">Conditions and actions defined by this spec</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {spec.triggers.map((trigger) => (
                <div key={trigger.id} className="border rounded-lg p-4">
                  <p className="font-medium mb-2">Condition: {trigger.condition}</p>
                  <div className="space-y-2">
                    {trigger.actions.map((action) => (
                      <div key={action.id} className="bg-gray-50 p-3 rounded text-sm">
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded mb-2">
                          {action.actionType}
                        </span>
                        <p>{action.description}</p>
                        {action.parameterId && (
                          <p className="text-xs text-gray-500 mt-1">
                            Parameter: {action.parameterId}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Config */}
      {spec.config && Object.keys(spec.config).length > 0 && (
        <div className="bg-white border rounded-lg">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Configuration</h2>
          </div>
          <div className="p-6">
            <pre className="bg-gray-50 p-4 rounded-md text-sm overflow-x-auto border">
              {JSON.stringify(spec.config, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
