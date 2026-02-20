'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Lock } from 'lucide-react';

interface RBACMatrixState {
  rbac: Record<string, Record<string, string>>;
  terminology: Record<string, Record<string, string>>;
}

const ROLE_LEVEL: Record<string, number> = {
  SUPERADMIN: 5,
  ADMIN: 4,
  OPERATOR: 3,
  EDUCATOR: 3,
  SUPER_TESTER: 2,
  TESTER: 1,
  STUDENT: 1,
  DEMO: 0,
};

/**
 * Access Control Matrix Editor
 * Displays editable RBAC and Terminology matrices for authorized roles.
 */
export default function AccessControlPage() {
  const { data: session } = useSession();
  const [currentTab, setCurrentTab] = useState<'rbac' | 'terminology'>('rbac');
  const [state, setState] = useState<RBACMatrixState>({
    rbac: {},
    terminology: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const userRole = session?.user?.role || 'VIEWER';
  const userLevel = ROLE_LEVEL[userRole] || 0;

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [rbacRes, termRes] = await Promise.all([
          fetch('/api/admin/access-control/entity-access'),
          fetch('/api/admin/terminology'),
        ]);

        if (rbacRes.ok) {
          const rbacData = await rbacRes.json();
          if (rbacData.contract?.matrix) {
            setState((prev) => ({
              ...prev,
              rbac: rbacData.contract.matrix,
            }));
          }
        }

        if (termRes.ok) {
          const termData = await termRes.json();
          if (termData.contract?.terms) {
            setState((prev) => ({
              ...prev,
              terminology: termData.contract.terms,
            }));
          }
        }
      } catch (err) {
        setError('Failed to load matrices');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSaveRBAC = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/access-control/entity-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix: state.rbac }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('RBAC matrix saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [state.rbac]);

  const handleSaveTerminology = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/terminology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ terms: state.terminology }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('Terminology saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [state.terminology]);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="space-y-6 p-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Access Control & Terminology</h1>
        <p className="text-sm text-gray-600 mt-2">
          Configure entity access permissions and terminology labels. You can only modify settings for roles below your authority level.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-300">
        <button
          onClick={() => setCurrentTab('rbac')}
          className={`px-4 py-2 font-medium transition-colors ${
            currentTab === 'rbac'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Access Control Matrix
        </button>
        <button
          onClick={() => setCurrentTab('terminology')}
          className={`px-4 py-2 font-medium transition-colors ${
            currentTab === 'terminology'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Terminology
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
        </div>
      )}

      {/* RBAC Tab */}
      {currentTab === 'rbac' && state.rbac && Object.keys(state.rbac).length > 0 && (
        <>
          <RBACMatrixTab
            matrix={state.rbac}
            userRole={userRole}
            userLevel={userLevel}
            onChange={(entity, role, value) => {
              setState((prev) => ({
                ...prev,
                rbac: {
                  ...prev.rbac,
                  [entity]: {
                    ...prev.rbac[entity],
                    [role]: value,
                  },
                },
              }));
            }}
            isSaving={isSaving}
          />
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleSaveRBAC}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save RBAC Matrix'}
            </button>
          </div>
        </>
      )}

      {/* Terminology Tab */}
      {currentTab === 'terminology' && state.terminology && Object.keys(state.terminology).length > 0 && (
        <>
          <TerminologyTab
            terms={state.terminology}
            userRole={userRole}
            userLevel={userLevel}
            onChange={(termKey, role, value) => {
              setState((prev) => ({
                ...prev,
                terminology: {
                  ...prev.terminology,
                  [termKey]: {
                    ...prev.terminology[termKey],
                    [role]: value,
                  },
                },
              }));
            }}
            isSaving={isSaving}
          />
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleSaveTerminology}
              disabled={isSaving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Terminology'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * RBAC Matrix Editor Tab
 */
function RBACMatrixTab({
  matrix,
  userRole,
  userLevel,
  onChange,
  isSaving,
}: {
  matrix: Record<string, Record<string, string>>;
  userRole: string;
  userLevel: number;
  onChange: (entity: string, role: string, value: string) => void;
  isSaving: boolean;
}) {
  const entities = Object.keys(matrix).sort();
  const roles = ['SUPERADMIN', 'ADMIN', 'OPERATOR', 'EDUCATOR', 'SUPER_TESTER', 'TESTER', 'STUDENT', 'DEMO'];

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="border-r border-gray-300 px-3 py-2 text-left text-sm font-semibold w-32">
              Entity
            </th>
            {roles.map((role) => {
              const targetLevel = ROLE_LEVEL[role] || 0;
              const canEdit = targetLevel < userLevel;
              return (
                <th
                  key={role}
                  className={`border-r border-gray-300 px-3 py-2 text-left text-sm font-semibold min-w-[120px] ${
                    !canEdit ? 'bg-gray-200 opacity-70' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {role}
                    {!canEdit && <Lock className="w-3 h-3" />}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {entities.map((entity) => (
            <tr key={entity} className="hover:bg-gray-50 border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-medium text-sm bg-gray-50">
                {entity}
              </td>
              {roles.map((role) => {
                const value = matrix[entity]?.[role] || '';
                const targetLevel = ROLE_LEVEL[role] || 0;
                const canEdit = targetLevel < userLevel;

                return (
                  <td
                    key={`${entity}-${role}`}
                    className={`border-r border-gray-300 px-2 py-1 ${
                      !canEdit ? 'bg-gray-100' : ''
                    }`}
                  >
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => canEdit && onChange(entity, role, e.target.value)}
                      disabled={isSaving || !canEdit}
                      placeholder="SCOPE:OPS"
                      className={`w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono ${
                        !canEdit ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
                      }`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-600 mt-3 px-3 py-2">
        Format: SCOPE:OPS (e.g., "ALL:CRUD", "DOMAIN:CR", "OWN:R", "NONE"). 🔒 Locked cells cannot be edited.
      </p>
    </div>
  );
}

/**
 * Terminology Editor Tab
 */
function TerminologyTab({
  terms,
  userRole,
  userLevel,
  onChange,
  isSaving,
}: {
  terms: Record<string, Record<string, string>>;
  userRole: string;
  userLevel: number;
  onChange: (termKey: string, role: string, value: string) => void;
  isSaving: boolean;
}) {
  const termKeys = Object.keys(terms).sort();
  const roles = ['SUPERADMIN', 'ADMIN', 'OPERATOR', 'EDUCATOR', 'SUPER_TESTER', 'TESTER', 'STUDENT', 'DEMO'];

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="border-r border-gray-300 px-3 py-2 text-left text-sm font-semibold w-32">
              Term
            </th>
            {roles.map((role) => {
              const targetLevel = ROLE_LEVEL[role] || 0;
              const canEdit = targetLevel < userLevel;
              return (
                <th
                  key={role}
                  className={`border-r border-gray-300 px-3 py-2 text-left text-sm font-semibold min-w-[140px] ${
                    !canEdit ? 'bg-gray-200 opacity-70' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {role}
                    {!canEdit && <Lock className="w-3 h-3" />}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {termKeys.map((termKey) => (
            <tr key={termKey} className="hover:bg-gray-50 border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-medium text-sm bg-gray-50">
                {termKey}
              </td>
              {roles.map((role) => {
                const value = terms[termKey]?.[role] || '';
                const targetLevel = ROLE_LEVEL[role] || 0;
                const canEdit = targetLevel < userLevel;

                return (
                  <td
                    key={`${termKey}-${role}`}
                    className={`border-r border-gray-300 px-2 py-1 ${
                      !canEdit ? 'bg-gray-100' : ''
                    }`}
                  >
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => canEdit && onChange(termKey, role, e.target.value)}
                      disabled={isSaving || !canEdit}
                      placeholder="Label"
                      maxLength={100}
                      className={`w-full px-2 py-1 border border-gray-300 rounded text-sm ${
                        !canEdit ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''
                      }`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-600 mt-3 px-3 py-2">
        User-friendly labels for each term in each role's perspective. 🔒 Locked cells cannot be edited.
      </p>
    </div>
  );
}
