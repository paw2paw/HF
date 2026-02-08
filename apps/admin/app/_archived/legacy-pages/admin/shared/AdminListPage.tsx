"use client";

import React, { useState, useRef, useEffect } from 'react';
import { List, TextInput, useListContext } from 'react-admin';
import { InlineEditableTable } from '../InlineEditableTable';
import type { TableConfig, ToolbarAction, TableHelpers } from './InlineEditableTableConfig';

const COLUMN_VISIBILITY_KEY = 'inlineEditableTable_columnVisibility';
const COLUMN_ORDER_KEY = 'inlineEditableTable_columnOrder';

// Toolbar Button Component for custom actions
const ToolbarButton = ({
  action,
  onRefresh
}: {
  action: ToolbarAction;
  onRefresh: () => void;
}) => {
  const [loading, setLoading] = useState(false);

  const colorMap: Record<string, { bg: string; hover: string; text: string }> = {
    green: { bg: '#10b981', hover: '#059669', text: 'white' },
    gray: { bg: '#6b7280', hover: '#4b5563', text: 'white' },
    red: { bg: '#ef4444', hover: '#dc2626', text: 'white' },
    blue: { bg: '#3b82f6', hover: '#2563eb', text: 'white' },
    yellow: { bg: '#f59e0b', hover: '#d97706', text: 'white' },
    purple: { bg: '#8b5cf6', hover: '#7c3aed', text: 'white' },
  };

  const colors = colorMap[action.color || 'gray'];

  const helpers: TableHelpers = {
    refresh: onRefresh,
    notify: (message, options) => {
      // Simple alert for now - could integrate with a toast system
      if (options.type === 'error') {
        alert(`Error: ${message}`);
      } else {
        console.log(`[${options.type}] ${message}`);
      }
    },
    dataProvider: null,
  };

  const handleClick = async () => {
    setLoading(true);
    try {
      await action.action(helpers);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '6px 12px',
        backgroundColor: loading ? '#9ca3af' : colors.bg,
        color: colors.text,
        border: 'none',
        borderRadius: '4px',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        opacity: loading ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!loading) e.currentTarget.style.backgroundColor = colors.hover;
      }}
      onMouseLeave={(e) => {
        if (!loading) e.currentTarget.style.backgroundColor = colors.bg;
      }}
    >
      {action.icon && <span>{action.icon}</span>}
      {loading ? 'Working...' : action.label}
    </button>
  );
};

// Column Picker Component
const ColumnPicker = ({
  fields,
  visibleColumns,
  onToggle,
  columnOrder,
  onReorder
}: {
  fields: string[];
  visibleColumns: Set<string>;
  onToggle: (field: string) => void;
  columnOrder: string[];
  onReorder: (newOrder: string[]) => void;
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPicker && pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  return (
    <div ref={pickerRef} style={{ position: 'relative', display: 'inline-block', marginLeft: '12px' }}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        style={{
          padding: '6px 12px',
          backgroundColor: showPicker ? '#3b82f6' : 'white',
          color: showPicker ? 'white' : '#374151',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        title="Toggle column visibility"
      >
        ☰ Columns ({visibleColumns.size}/{fields.length})
      </button>
      {showPicker && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          padding: '8px',
          minWidth: '250px',
          maxHeight: '400px',
          overflowY: 'auto',
          zIndex: 1001,
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#6b7280',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>Show/Hide & Reorder</span>
            <button
              onClick={() => {
                fields.forEach(field => {
                  if (!visibleColumns.has(field)) {
                    onToggle(field);
                  }
                });
              }}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Show All
            </button>
          </div>
          {columnOrder.map(field => (
            <div
              key={field}
              draggable
              onDragStart={() => setDraggedItem(field)}
              onDragEnd={() => {
                setDraggedItem(null);
                setDragOverItem(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverItem(field);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== field) {
                  const newOrder = [...columnOrder];
                  const draggedIdx = newOrder.indexOf(draggedItem);
                  const targetIdx = newOrder.indexOf(field);

                  // Remove dragged item and insert at target position
                  newOrder.splice(draggedIdx, 1);
                  newOrder.splice(targetIdx, 0, draggedItem);

                  onReorder(newOrder);
                }
                setDraggedItem(null);
                setDragOverItem(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                cursor: draggedItem ? 'grabbing' : 'grab',
                fontSize: '13px',
                borderRadius: '4px',
                backgroundColor:
                  draggedItem === field ? '#dbeafe' :
                  dragOverItem === field && draggedItem ? '#f0f9ff' :
                  visibleColumns.has(field) ? '#f0f9ff' :
                  'transparent',
                opacity: draggedItem === field ? 0.5 : 1,
                border: dragOverItem === field && draggedItem && draggedItem !== field ? '2px dashed #3b82f6' : '2px solid transparent',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!draggedItem) {
                  e.currentTarget.style.backgroundColor = visibleColumns.has(field) ? '#e0f2fe' : '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (!draggedItem) {
                  e.currentTarget.style.backgroundColor = visibleColumns.has(field) ? '#f0f9ff' : 'transparent';
                }
              }}
            >
              <span style={{
                fontSize: '16px',
                color: '#9ca3af',
                cursor: 'grab',
                userSelect: 'none'
              }}>
                ⋮⋮
              </span>
              <input
                type="checkbox"
                checked={visibleColumns.has(field)}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggle(field);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer' }}
              />
              <span>{field.replace(/([A-Z])/g, ' $1').trim()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface AdminListPageProps {
  config: TableConfig;
  perPage?: number;
  defaultSort?: { field: string; order: 'ASC' | 'DESC' };
  searchable?: boolean;
  filters?: React.ReactElement[];
  allFields?: string[]; // All available fields from the model (for column picker)
}

/**
 * Reusable admin list page component
 * Wraps InlineEditableTable with React-Admin List
 *
 * Usage:
 * <AdminListPage
 *   config={parametersTableConfig}
 *   perPage={50}
 *   defaultSort={{ field: 'id', order: 'ASC' }}
 *   searchable
 * />
 */
export const AdminListPage = ({
  config,
  perPage = 50,
  defaultSort = { field: 'id', order: 'ASC' },
  searchable = true,
  filters = [],
  allFields
}: AdminListPageProps) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Use allFields if provided, otherwise fall back to config columns
  const availableFields = allFields || config.columns.map(col => col.field);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    // Load saved visibility from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved column visibility', e);
        }
      }
    }
    // Default: show columns from config
    return new Set(config.columns.map(col => col.field));
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    // Load saved order from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(COLUMN_ORDER_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Validate that all fields are present
          if (parsed.length === availableFields.length && availableFields.every((f: string) => parsed.includes(f))) {
            return parsed;
          }
        } catch (e) {
          console.error('Failed to parse saved column order', e);
        }
      }
    }
    return availableFields;
  });

  // Save visibility changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(Array.from(visibleColumns)));
    }
  }, [visibleColumns]);

  // Save column order to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  const toggleColumnVisibility = (field: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        // Don't allow hiding all columns
        if (next.size === 1) {
          return prev;
        }
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const handleReorder = (newOrder: string[]) => {
    setColumnOrder(newOrder);
  };

  const defaultFilters = searchable
    ? [<TextInput key="q" source="q" label="Search" alwaysOn />, ...filters]
    : filters;

  return (
    <>
      <style>
        {`
          /* Make React-Admin filter and action areas sticky on horizontal scroll */
          .RaList-actions {
            position: sticky !important;
            left: 0 !important;
            background-color: white !important;
            z-index: 100 !important;
            justify-content: flex-start !important;
          }

          .RaFilterForm-root,
          .MuiToolbar-root.RaToolbar-root {
            position: sticky !important;
            left: 0 !important;
            background-color: white !important;
            z-index: 99 !important;
          }

          /* Ensure the search input stays in place */
          .RaFilterForm-root .MuiFormControl-root {
            background-color: white !important;
          }

          /* Move actions to the left instead of right */
          .RaList-main > .MuiToolbar-root {
            justify-content: flex-start !important;
          }
        `}
      </style>
      <List
        perPage={perPage}
        sort={defaultSort}
        filters={defaultFilters.length > 0 ? defaultFilters : undefined}
        actions={
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            position: 'sticky',
            left: 0,
            backgroundColor: 'white',
            zIndex: 100
          }}>
            <ColumnPicker
              fields={availableFields}
              visibleColumns={visibleColumns}
              onToggle={toggleColumnVisibility}
              columnOrder={columnOrder}
              onReorder={handleReorder}
            />
            {config.toolbarActions?.map((action, idx) => (
              <ToolbarButton
                key={idx}
                action={action}
                onRefresh={() => window.location.reload()}
              />
            ))}
          </div>
        }
      >
        <AdminListInner
          config={config}
          selectedRows={selectedRows}
          setSelectedRows={setSelectedRows}
          visibleColumns={visibleColumns}
          allFields={availableFields}
          columnOrder={columnOrder}
        />
      </List>
    </>
  );
};

const AdminListInner = ({
  config,
  selectedRows,
  setSelectedRows,
  visibleColumns,
  allFields,
  columnOrder
}: {
  config: TableConfig;
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;
  visibleColumns: Set<string>;
  allFields: string[];
  columnOrder: string[];
}) => {
  const { data } = useListContext();

  if (!data) return <div>Loading...</div>;

  // Use all available fields so the table can render any column the user selects
  const fields = allFields;

  return (
    <InlineEditableTable
      data={data}
      fields={fields}
      config={config}
      selectedRows={selectedRows}
      setSelectedRows={setSelectedRows}
      visibleColumns={visibleColumns}
      columnOrder={columnOrder}
    />
  );
};
