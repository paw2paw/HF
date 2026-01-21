import React, { useState, useEffect } from 'react';
import type { TableConfig, BulkAction } from '../shared/InlineEditableTableConfig';

/**
 * Dynamic Prompts Modal Component
 * Full modal for managing parameter-slug links
 */
const DynamicPromptsModal = ({
  isOpen,
  onClose,
  parameterId,
  parameterName,
  rowId,
  onUpdate
}: {
  isOpen: boolean;
  onClose: () => void;
  parameterId: string;
  parameterName: string;
  rowId: string;
  onUpdate: () => void;
}) => {
  const [links, setLinks] = useState<any[]>([]);
  const [availableSlugs, setAvailableSlugs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlugId, setSelectedSlugId] = useState('');
  const [newLinkWeight, setNewLinkWeight] = useState(1.0);
  const [newLinkMode, setNewLinkMode] = useState<'ABSOLUTE' | 'DELTA'>('ABSOLUTE');

  useEffect(() => {
    if (isOpen && rowId) {
      fetchData();
    }
  }, [isOpen, rowId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setLinks(data.links || []);
      setAvailableSlugs(data.availableSlugs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async () => {
    if (!selectedSlugId) return;
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slugId: selectedSlugId,
          weight: newLinkWeight,
          mode: newLinkMode
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSelectedSlugId('');
      setNewLinkWeight(1.0);
      setNewLinkMode('ABSOLUTE');
      fetchData();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to attach prompt');
    }
  };

  const handleDetach = async (slugId: string) => {
    if (!confirm('Detach this dynamic prompt?')) return;
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts?slugId=${slugId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      fetchData();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to detach prompt');
    }
  };

  const handleUpdateLink = async (slugId: string, weight: number, mode: string) => {
    try {
      const res = await fetch(`/api/parameters/${rowId}/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugId, weight, mode })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      fetchData();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update link');
    }
  };

  // Filter out already linked slugs
  const linkedSlugIds = new Set(links.map(l => l.slug?.id));
  const unlinkedSlugs = availableSlugs.filter(s => !linkedSlugIds.has(s.id));

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          width: '600px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Dynamic Prompts</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Parameter: <strong>{parameterName}</strong> ({parameterId})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#9ca3af'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            color: '#dc2626',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
        ) : (
          <>
            {/* Linked Prompts */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                Linked Dynamic Prompts ({links.length})
              </h3>
              {links.length === 0 ? (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '13px'
                }}>
                  No dynamic prompts linked to this parameter yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {links.map((link: any) => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '500',
                              backgroundColor: link.slug?.sourceType === 'COMPOSITE' ? '#f59e0b' : '#6366f1',
                              color: 'white'
                            }}
                          >
                            {link.slug?.sourceType}
                          </span>
                          <span style={{ fontWeight: '500', fontSize: '14px' }}>{link.slug?.name}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {link.slug?.slug}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#6b7280' }}>Weight</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="10"
                            value={link.weight}
                            onChange={(e) => handleUpdateLink(link.slug?.id, parseFloat(e.target.value) || 1, link.mode)}
                            style={{
                              width: '60px',
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#6b7280' }}>Mode</label>
                          <select
                            value={link.mode}
                            onChange={(e) => handleUpdateLink(link.slug?.id, link.weight, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            <option value="ABSOLUTE">Absolute</option>
                            <option value="DELTA">Delta</option>
                          </select>
                        </div>
                        <button
                          onClick={() => handleDetach(link.slug?.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginTop: '14px'
                          }}
                        >
                          Detach
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attach New Prompt */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              border: '1px solid #bbf7d0'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#166534' }}>
                Attach New Dynamic Prompt
              </h3>
              {unlinkedSlugs.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  All available dynamic prompts are already linked.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                      Dynamic Prompt
                    </label>
                    <select
                      value={selectedSlugId}
                      onChange={(e) => setSelectedSlugId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">Select a dynamic prompt...</option>
                      {unlinkedSlugs.map((slug: any) => (
                        <option key={slug.id} value={slug.id}>
                          [{slug.sourceType}] {slug.name} ({slug.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                      Weight
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={newLinkWeight}
                      onChange={(e) => setNewLinkWeight(parseFloat(e.target.value) || 1)}
                      style={{
                        width: '70px',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                      Mode
                    </label>
                    <select
                      value={newLinkMode}
                      onChange={(e) => setNewLinkMode(e.target.value as 'ABSOLUTE' | 'DELTA')}
                      style={{
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px'
                      }}
                    >
                      <option value="ABSOLUTE">Absolute</option>
                      <option value="DELTA">Delta</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAttach}
                    disabled={!selectedSlugId}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: selectedSlugId ? '#10b981' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: selectedSlugId ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Attach
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Dynamic Prompts Pills Component
 * Shows linked dynamic prompts for a parameter with ability to manage them
 */
const DynamicPromptsPills = ({
  links,
  rowId,
  parameterId,
  parameterName,
  onRefresh
}: {
  links: any[];
  rowId: string;
  parameterId: string;
  parameterName: string;
  onRefresh: () => void;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const promptLinks = links || [];
  const count = promptLinks.length;

  return (
    <>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
        {promptLinks.slice(0, 2).map((link: any) => (
          <span
            key={link.id}
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '500',
              backgroundColor: link.slug?.sourceType === 'COMPOSITE' ? '#f59e0b' : '#6366f1',
              color: 'white',
              maxWidth: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={link.slug?.name}
          >
            {link.slug?.name || link.slug?.slug}
          </span>
        ))}
        {count > 2 && (
          <span style={{ fontSize: '10px', color: '#6b7280' }}>+{count - 2}</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setModalOpen(true);
          }}
          style={{
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: '500',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            cursor: 'pointer',
            marginLeft: count > 0 ? '4px' : 0
          }}
        >
          {count === 0 ? '+ Attach' : 'Manage'}
        </button>
      </div>
      <DynamicPromptsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        parameterId={parameterId}
        parameterName={parameterName}
        rowId={rowId}
        onUpdate={onRefresh}
      />
    </>
  );
};

/**
 * Status Pills Component - can be reused across different tables
 */
const StatusPills = ({
  tags,
  rowId,
  onToggleActive
}: {
  tags: any[],
  rowId: string,
  onToggleActive: (rowId: string, currentlyActive: boolean) => void
}) => {
  const tagNames = tags?.map((t: any) => t.tag?.name).filter(Boolean) || [];
  const isActive = tagNames.some((name: string) => name.toLowerCase() === 'active');
  const isMvpCore = tagNames.some((name: string) => name.toLowerCase() === 'mvp' || name.toLowerCase() === 'mvpcore');

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleActive(rowId, isActive);
        }}
        style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: isActive ? '#10b981' : '#6b7280',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        {isActive ? 'Active' : 'Inactive'}
      </button>
      {isMvpCore && (
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: '#3b82f6',
          color: 'white'
        }}>
          MVP
        </span>
      )}
    </div>
  );
};

/**
 * Parameters table configuration
 * Defines columns, behaviors, and bulk actions for the parameters resource
 */
export const parametersTableConfig: TableConfig = {
  resource: 'parameters',

  columns: [
    {
      field: 'parameterId',
      label: 'Parameter ID',
      width: 150,
      editable: false,
      sortable: true
    },
    {
      field: 'name',
      label: 'Name',
      width: 200,
      editable: true,
      sortable: true
    },
    {
      field: 'domainGroup',
      label: 'Domain Group',
      width: 150,
      editable: true,
      sortable: true
    },
    {
      field: 'sectionId',
      label: 'Section ID',
      width: 150,
      editable: true,
      sortable: true
    },
    {
      field: 'scaleType',
      label: 'Scale Type',
      width: 150,
      editable: true,
      sortable: true
    },
    {
      field: 'directionality',
      label: 'Directionality',
      width: 150,
      editable: true,
      sortable: true
    },
    {
      field: 'definition',
      label: 'Definition',
      width: 400,
      editable: true,
      sortable: true
    },
    {
      field: 'tags',
      label: 'Tags',
      width: 200,
      editable: false,
      sortable: false
    },
    {
      field: 'promptSlugLinks',
      label: 'Dynamic Slug Links',
      width: 220,
      editable: false,
      sortable: false
    }
  ],

  defaultWidths: {
    definition: 400,
    tags: 200,
    promptSlugLinks: 220,
  },

  readOnlyFields: ['id', 'parameterId', 'tags', 'promptSlugLinks', 'createdAt', 'updatedAt'],

  customRenderers: {
    tags: (value, record, helpers) => {
      const toggleActive = async (rowId: string, currentlyActive: boolean) => {
        try {
          if (currentlyActive) {
            await fetch(`/api/parameters/${rowId}/tags?tagName=Active`, {
              method: 'DELETE'
            });
            helpers.notify('Set to Inactive', { type: 'info' });
          } else {
            await fetch(`/api/parameters/${rowId}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagName: 'Active' })
            });
            helpers.notify('Set to Active', { type: 'success' });
          }
          helpers.refresh();
        } catch (error: any) {
          helpers.notify(`Error: ${error.message || 'Failed to toggle active'}`, { type: 'error' });
        }
      };

      return <StatusPills tags={value} rowId={record.id} onToggleActive={toggleActive} />;
    },
    promptSlugLinks: (value, record, helpers) => {
      return (
        <DynamicPromptsPills
          links={value}
          rowId={record.id}
          parameterId={record.parameterId}
          parameterName={record.name || record.parameterId}
          onRefresh={helpers.refresh}
        />
      );
    }
  },

  bulkActions: [
    {
      label: 'Set Active',
      color: 'green',
      action: async (selectedIds, helpers) => {
        await Promise.all(
          selectedIds.map(id =>
            fetch(`/api/parameters/${id}/tags`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagName: 'Active' })
            })
          )
        );
        helpers.notify(`Set ${selectedIds.length} parameter(s) to Active`, { type: 'success' });
        helpers.refresh();
      }
    },
    {
      label: 'Set Inactive',
      color: 'gray',
      action: async (selectedIds, helpers) => {
        await Promise.all(
          selectedIds.map(id =>
            fetch(`/api/parameters/${id}/tags?tagName=Active`, {
              method: 'DELETE'
            })
          )
        );
        helpers.notify(`Set ${selectedIds.length} parameter(s) to Inactive`, { type: 'success' });
        helpers.refresh();
      }
    },
    {
      label: 'Delete Selected',
      color: 'red',
      action: async (selectedIds, helpers) => {
        if (!confirm(`Delete ${selectedIds.length} selected row(s)?`)) return;

        await Promise.all(
          selectedIds.map(id =>
            helpers.dataProvider.delete('parameters', { id, previousData: {} })
          )
        );
        helpers.notify(`Deleted ${selectedIds.length} parameter(s)`, { type: 'success' });
        helpers.refresh();
      }
    }
  ],

  toolbarActions: [
    {
      label: 'Export CSV',
      icon: '↓',
      color: 'blue',
      action: async () => {
        // Trigger download by navigating to export endpoint
        window.location.href = '/api/parameters/export';
      }
    },
    {
      label: 'Import CSV',
      icon: '↑',
      color: 'green',
      action: async (helpers) => {
        // Create a hidden file input and trigger it
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          const formData = new FormData();
          formData.append('file', file);

          try {
            const res = await fetch('/api/parameters/import', {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();

            if (!data.ok) {
              alert(`Import failed: ${data.error}`);
              return;
            }

            // Show results
            let message = data.summary;
            if (data.results.errors.length > 0) {
              message += '\n\nErrors:\n' + data.results.errors.slice(0, 10).join('\n');
              if (data.results.errors.length > 10) {
                message += `\n... and ${data.results.errors.length - 10} more errors`;
              }
            }
            alert(message);
            helpers.refresh();
          } catch (err: any) {
            alert(`Import error: ${err.message}`);
          }
        };
        input.click();
      }
    }
  ],

  settings: {
    enableInlineEdit: true,
    enableSorting: true,
    enableColumnReorder: true,
    enableColumnResize: true,
    enableBulkSelect: true
  }
};
