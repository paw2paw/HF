import React from 'react';
import type { TableConfig } from '../shared/InlineEditableTableConfig';

/**
 * Transcripts table configuration
 * Displays raw transcript files from HF_KB_PATH/sources/transcripts/raw
 */
export const transcriptsTableConfig: TableConfig = {
  resource: 'transcripts',

  columns: [
    {
      field: 'filename',
      label: 'Filename',
      width: 350,
      editable: false,
      sortable: true
    },
    {
      field: 'type',
      label: 'Type',
      width: 100,
      editable: false,
      sortable: true
    },
    {
      field: 'status',
      label: 'Status',
      width: 130,
      editable: false,
      sortable: true
    },
    {
      field: 'date',
      label: 'Date',
      width: 120,
      editable: false,
      sortable: true
    },
    {
      field: 'callCount',
      label: 'Calls',
      width: 100,
      editable: false,
      sortable: true
    },
    {
      field: 'sizeMB',
      label: 'Size (MB)',
      width: 120,
      editable: false,
      sortable: true
    },
    {
      field: 'modifiedAt',
      label: 'Modified',
      width: 200,
      editable: false,
      sortable: true
    }
  ],

  defaultWidths: {
    filename: 350,
    type: 100,
    status: 130,
    date: 120,
    callCount: 100,
    sizeMB: 120,
    modifiedAt: 200
  },

  readOnlyFields: ['id', 'filename', 'type', 'status', 'date', 'callCount', 'sizeMB', 'sizeBytes', 'modifiedAt', 'path', 'fileHash'],

  customRenderers: {
    type: (value) => {
      if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
      const colors = {
        Batch: '#3b82f6',
        Single: '#8b5cf6',
        Unknown: '#6b7280'
      };
      const color = colors[value as keyof typeof colors] || '#6b7280';
      return (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: `${color}20`,
          color: color
        }}>
          {value}
        </span>
      );
    },
    status: (value) => {
      if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
      const statusConfig = {
        PENDING: { color: '#f59e0b', label: 'Pending' },
        PROCESSING: { color: '#3b82f6', label: 'Processing' },
        COMPLETED: { color: '#10b981', label: 'Completed' },
        FAILED: { color: '#ef4444', label: 'Failed' },
        Unprocessed: { color: '#6b7280', label: 'Unprocessed' }
      };
      const config = statusConfig[value as keyof typeof statusConfig] || { color: '#6b7280', label: value };
      return (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 500,
          backgroundColor: `${config.color}20`,
          color: config.color
        }}>
          {config.label}
        </span>
      );
    },
    modifiedAt: (value) => {
      if (!value) return '—';
      const date = new Date(value);
      return date.toLocaleString();
    },
    callCount: (value) => {
      if (!value || value === 0) return <span style={{ color: '#9ca3af' }}>—</span>;
      return <span style={{ fontWeight: 500 }}>{value.toLocaleString()}</span>;
    },
    sizeMB: (value) => {
      if (!value) return '—';
      return `${value} MB`;
    },
    date: (value) => {
      if (!value) return <span style={{ color: '#9ca3af' }}>—</span>;
      return <span style={{ fontFamily: 'monospace' }}>{value}</span>;
    }
  },

  settings: {
    enableInlineEdit: false, // Read-only view
    enableSorting: true,
    enableColumnReorder: true,
    enableColumnResize: true,
    enableBulkSelect: false // No bulk actions for read-only files
  }
};
