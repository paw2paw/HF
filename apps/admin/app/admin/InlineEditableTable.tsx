"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDataProvider, useNotify, useRefresh } from 'react-admin';
import type { TableConfig, TableHelpers } from './shared/InlineEditableTableConfig';

interface EditableCell {
  rowId: string;
  field: string;
  value: any;
}

const STORAGE_KEY = 'inlineEditableTable_columnWidths';
const COLUMN_ORDER_KEY = 'inlineEditableTable_columnOrder';
const COLUMN_VISIBILITY_KEY = 'inlineEditableTable_columnVisibility';

const getDefaultWidth = (field: string, config?: TableConfig) => {
  if (config?.defaultWidths?.[field]) return config.defaultWidths[field];
  if (field === 'definition') return 400;
  if (field === 'tags') return 200;
  return 150;
};

const getColorStyles = (color: string) => {
  const colors = {
    green: { bg: '#10b981', hover: '#059669' },
    gray: { bg: '#6b7280', hover: '#4b5563' },
    red: { bg: '#dc2626', hover: '#b91c1c' },
    blue: { bg: '#3b82f6', hover: '#2563eb' },
    yellow: { bg: '#f59e0b', hover: '#d97706' }
  };
  return colors[color as keyof typeof colors] || colors.gray;
};

export const InlineEditableTable = ({
  data,
  fields,
  config,
  selectedRows: externalSelectedRows,
  setSelectedRows: externalSetSelectedRows,
  visibleColumns: externalVisibleColumns,
  columnOrder: externalColumnOrder
}: {
  data: any[],
  fields: string[],
  config?: TableConfig,
  selectedRows?: Set<string>,
  setSelectedRows?: (rows: Set<string>) => void,
  visibleColumns?: Set<string>,
  columnOrder?: string[]
}) => {
  const [editingCell, setEditingCell] = useState<EditableCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    // Load saved widths from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved column widths', e);
        }
      }
    }
    // Default widths
    return fields.reduce((acc, field) => ({ ...acc, [field]: getDefaultWidth(field, config) }), {});
  });
  const [internalColumnOrder, setInternalColumnOrder] = useState<string[]>(() => {
    // Load saved order from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_ORDER_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate that all fields are present
          if (parsed.length === fields.length && fields.every((f: string) => parsed.includes(f))) {
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse saved column order', e);
        }
      }
    }
    return fields;
  });
  const [resizing, setResizing] = useState<{ field: string; startX: number; startWidth: number } | null>(null);
  const [sortConfig, setSortConfig] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>([]);
  const [internalSelectedRows, setInternalSelectedRows] = useState<Set<string>>(new Set());
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<Set<string>>(() => {
    // Load saved visibility from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return new Set(parsed);
        } catch (e) {
          console.error('Failed to parse saved column visibility', e);
        }
      }
    }
    // Default: all columns visible
    return new Set(fields);
  });

  // Use external state if provided, otherwise use internal state
  const selectedRows = externalSelectedRows !== undefined ? externalSelectedRows : internalSelectedRows;
  const setSelectedRows = externalSetSelectedRows || setInternalSelectedRows;
  const visibleColumns = externalVisibleColumns !== undefined ? externalVisibleColumns : internalVisibleColumns;
  const columnOrder = externalColumnOrder !== undefined ? externalColumnOrder : internalColumnOrder;

  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  // Create helpers object for custom renderers and bulk actions
  const helpers: TableHelpers = {
    refresh,
    notify,
    dataProvider
  };

  // Save column widths to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnWidths));
    }
  }, [columnWidths]);

  // Save column order to localStorage whenever it changes (only if using internal state)
  useEffect(() => {
    if (typeof window !== 'undefined' && externalColumnOrder === undefined) {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    }
  }, [columnOrder, externalColumnOrder]);

  // Handle mouse move during resize
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const delta = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [resizing.field]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  const handleCellClick = (rowId: string, field: string, currentValue: any) => {
    if (field === 'id' || field === 'parameterId' || field === 'tags') return; // Don't allow editing these

    setEditingCell({ rowId, field, value: currentValue });
    setEditValue(currentValue || '');
  };

  const handleSave = async () => {
    if (!editingCell) return;

    try {
      // Get the full record from data
      const record = data.find(r => r.id === editingCell.rowId);
      if (!record) {
        notify('Record not found', { type: 'error' });
        return;
      }

      // Send full record with updated field
      const updatedData = {
        ...record,
        [editingCell.field]: editValue || null
      };

      // Remove read-only fields from update
      delete updatedData.tags;
      delete updatedData.id;
      delete updatedData.createdAt;
      delete updatedData.updatedAt;

      await dataProvider.update('parameters', {
        id: editingCell.rowId,
        data: updatedData,
        previousData: record
      });

      notify('Updated successfully', { type: 'success' });
      setEditingCell(null);
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message || 'Failed to update'}`, { type: 'error' });
      console.error('Update error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const isEditing = (rowId: string, field: string) => {
    return editingCell?.rowId === rowId && editingCell?.field === field;
  };

  const handleResizeStart = (field: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      field,
      startX: e.clientX,
      startWidth: columnWidths[field] || getDefaultWidth(field)
    });
  };

  const handleSort = (field: string, e: React.MouseEvent) => {
    if (field === 'tags') return; // Don't allow sorting by tags

    e.preventDefault();

    // Check if Shift key is held for multi-column sort
    if (e.shiftKey) {
      setSortConfig(prev => {
        const existing = prev.find(s => s.field === field);
        if (existing) {
          // Toggle direction or remove if already desc
          if (existing.direction === 'asc') {
            return prev.map(s => s.field === field ? { ...s, direction: 'desc' as const } : s);
          } else {
            return prev.filter(s => s.field !== field);
          }
        } else {
          // Add to sort config
          return [...prev, { field, direction: 'asc' as const }];
        }
      });
    } else {
      // Single column sort (replace all)
      const existing = sortConfig.find(s => s.field === field);
      if (existing && existing.direction === 'asc') {
        setSortConfig([{ field, direction: 'desc' }]);
      } else if (existing && existing.direction === 'desc') {
        setSortConfig([]);
      } else {
        setSortConfig([{ field, direction: 'asc' }]);
      }
    }
  };

  // Sort data based on sortConfig
  const sortedData = React.useMemo(() => {
    if (sortConfig.length === 0) return data;

    return [...data].sort((a, b) => {
      for (const { field, direction } of sortConfig) {
        const aVal = a[field];
        const bVal = b[field];

        // Handle null/undefined
        if (aVal == null && bVal == null) continue;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Compare values
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        if (comparison !== 0) {
          return direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
  }, [data, sortConfig]);

  const getSortIndicator = (field: string) => {
    const sortIndex = sortConfig.findIndex(s => s.field === field);
    if (sortIndex === -1) return null;

    const sort = sortConfig[sortIndex];
    const arrow = sort.direction === 'asc' ? '↑' : '↓';
    const badge = sortConfig.length > 1 ? `${sortIndex + 1}` : '';

    return (
      <span style={{ marginLeft: '4px', fontSize: '12px', color: '#3b82f6', fontWeight: 'bold' }}>
        {arrow}{badge}
      </span>
    );
  };

  const toggleRowSelection = (rowId: string) => {
    const next = new Set(selectedRows);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    setSelectedRows(next);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === sortedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedData.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;

    if (!confirm(`Delete ${selectedRows.size} selected row(s)?`)) return;

    try {
      // Delete all selected rows
      await Promise.all(
        Array.from(selectedRows).map(id =>
          dataProvider.delete('parameters', { id, previousData: { id } })
        )
      );

      notify(`Deleted ${selectedRows.size} parameter(s)`, { type: 'success' });
      setSelectedRows(new Set());
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message || 'Failed to delete'}`, { type: 'error' });
      console.error('Bulk delete error:', error);
    }
  };

  const handleBulkSetActive = async () => {
    if (selectedRows.size === 0) return;

    try {
      // Add "Active" tag to all selected rows
      await Promise.all(
        Array.from(selectedRows).map(id =>
          fetch(`/api/parameters/${id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagName: 'Active' })
          })
        )
      );

      notify(`Set ${selectedRows.size} parameter(s) to Active`, { type: 'success' });
      setSelectedRows(new Set());
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message || 'Failed to set active'}`, { type: 'error' });
      console.error('Bulk set active error:', error);
    }
  };

  const handleBulkSetInactive = async () => {
    if (selectedRows.size === 0) return;

    try {
      // Remove "Active" tag from all selected rows
      await Promise.all(
        Array.from(selectedRows).map(id =>
          fetch(`/api/parameters/${id}/tags?tagName=Active`, {
            method: 'DELETE'
          })
        )
      );

      notify(`Set ${selectedRows.size} parameter(s) to Inactive`, { type: 'success' });
      setSelectedRows(new Set());
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message || 'Failed to set inactive'}`, { type: 'error' });
      console.error('Bulk set inactive error:', error);
    }
  };

  const toggleActive = async (rowId: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        // Remove Active tag
        await fetch(`/api/parameters/${rowId}/tags?tagName=Active`, {
          method: 'DELETE'
        });
        notify('Set to Inactive', { type: 'info' });
      } else {
        // Add Active tag
        await fetch(`/api/parameters/${rowId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagName: 'Active' })
        });
        notify('Set to Active', { type: 'success' });
      }
      refresh();
    } catch (error: any) {
      notify(`Error: ${error.message || 'Failed to toggle active'}`, { type: 'error' });
      console.error('Toggle active error:', error);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {selectedRows.size > 0 && (
        <div style={{
          position: 'fixed',
          top: '140px',
          right: '24px',
          zIndex: 1000,
          padding: '12px 16px',
          backgroundColor: '#dbeafe',
          border: '2px solid #93c5fd',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          maxWidth: 'calc(100vw - 300px)',
        }}>
          <button
            onClick={() => setSelectedRows(new Set())}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '20px',
              height: '20px',
              padding: '0',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Clear selection"
          >
            ×
          </button>
          <span style={{ fontWeight: 600, color: '#1e40af', marginRight: '8px' }}>
            {selectedRows.size} row(s) selected
          </span>
          {/* Render bulk actions from config if available */}
          {config?.bulkActions ? (
            config.bulkActions.map((action, index) => {
              const colorStyles = getColorStyles(action.color);
              return (
                <button
                  key={index}
                  onClick={async () => {
                    try {
                      await action.action(Array.from(selectedRows), helpers);
                      setSelectedRows(new Set());
                    } catch (error: any) {
                      notify(`Error: ${error.message || 'Action failed'}`, { type: 'error' });
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: colorStyles.bg,
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colorStyles.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colorStyles.bg;
                  }}
                >
                  {action.label}
                </button>
              );
            })
          ) : (
            // Default bulk actions if no config provided
            <>
              <button
                onClick={handleBulkSetActive}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Set Active
              </button>
              <button
                onClick={handleBulkSetInactive}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Set Inactive
              </button>
              <button
                onClick={handleBulkDelete}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Delete Selected
              </button>
            </>
          )}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
          tableLayout: 'fixed'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{
                padding: '12px 8px',
                width: '40px',
                borderRight: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <input
                  type="checkbox"
                  checked={selectedRows.size === sortedData.length && sortedData.length > 0}
                  onChange={toggleAllRows}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {columnOrder.filter(field => visibleColumns.has(field)).map(field => (
                <th
                  key={field}
                  onClick={(e) => handleSort(field, e)}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'capitalize',
                    position: 'relative',
                    width: `${columnWidths[field] || getDefaultWidth(field)}px`,
                    borderRight: '1px solid #e5e7eb',
                    cursor: resizing ? 'col-resize' : field === 'tags' ? 'default' : 'pointer',
                    userSelect: 'none',
                    backgroundColor: '#f3f4f6'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                    {getSortIndicator(field)}
                  </div>
                  <div
                    onMouseDown={(e) => handleResizeStart(field, e)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '8px',
                      cursor: 'col-resize',
                      userSelect: 'none',
                      backgroundColor: resizing?.field === field ? '#3b82f6' : 'transparent',
                      transition: 'background-color 0.2s',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => {
                      if (!resizing) {
                        e.currentTarget.style.backgroundColor = '#93c5fd';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!resizing) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={row.id}
              style={{
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: selectedRows.has(row.id)
                  ? '#eff6ff'
                  : rowIndex % 2 === 0 ? 'white' : '#f9fafb'
              }}
            >
              <td style={{
                padding: '8px',
                borderRight: '1px solid #e5e7eb',
                textAlign: 'center'
              }}>
                <input
                  type="checkbox"
                  checked={selectedRows.has(row.id)}
                  onChange={() => toggleRowSelection(row.id)}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              {columnOrder.filter(field => visibleColumns.has(field)).map(field => {
                const isEditingThis = isEditing(row.id, field);
                const value = row[field];
                const isReadOnly = config?.readOnlyFields?.includes(field) ||
                  field === 'id' || field === 'parameterId' || field === 'tags';
                const isImmutableKey = field === 'id' || field === 'parameterId';

                return (
                  <td
                    key={field}
                    onClick={() => !isReadOnly && handleCellClick(row.id, field, value)}
                    style={{
                      padding: '8px 16px',
                      cursor: isReadOnly ? 'default' : 'pointer',
                      position: 'relative',
                      width: `${columnWidths[field] || getDefaultWidth(field)}px`,
                      maxWidth: `${columnWidths[field] || getDefaultWidth(field)}px`,
                      overflow: 'hidden',
                      borderRight: '1px solid #e5e7eb'
                    }}
                  >
                    {isEditingThis ? (
                      field === 'definition' ? (
                        <textarea
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={handleKeyDown}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '2px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleSave}
                          onKeyDown={handleKeyDown}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            border: '2px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontFamily: 'inherit'
                          }}
                        />
                      )
                    ) : (
                      <div style={{
                        padding: '2px 0',
                        minHeight: '20px',
                        color: isImmutableKey ? '#111827' : isReadOnly ? '#6b7280' : '#111827',
                        fontWeight: isImmutableKey ? 600 : isReadOnly ? 500 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: field === 'definition' ? 'normal' : 'nowrap'
                      }}>
                        {/* Use custom renderer if available in config */}
                        {config?.customRenderers?.[field] ? (
                          config.customRenderers[field](value, row, helpers)
                        ) : field === 'tags' ? (
                          <StatusPills tags={value} rowId={row.id} onToggleActive={toggleActive} />
                        ) : (
                          value || <span style={{ color: '#d1d5db' }}>—</span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div style={{
      padding: '8px 16px',
      fontSize: '12px',
      color: '#6b7280',
      backgroundColor: '#f9fafb',
      borderTop: '1px solid #e5e7eb',
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap'
    }}>
      {sortConfig.length > 0 && (
        <span>
          Sorting: {sortConfig.map((s, i) => `${i + 1}. ${s.field} ${s.direction}`).join(', ')}
          {' • Hold Shift to add/remove columns'}
        </span>
      )}
      <span>
        💡 Use Columns button to show/hide and reorder columns • Drag column borders to resize • Click headers to sort (Shift+click for multi-column)
      </span>
    </div>
  </div>
  );
};

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
