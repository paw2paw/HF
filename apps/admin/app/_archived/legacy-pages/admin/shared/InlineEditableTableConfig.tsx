/**
 * Configuration types for InlineEditableTable
 * Used to customize table behavior per resource
 */

export interface ColumnConfig {
  field: string;
  label?: string;
  width?: number;
  editable?: boolean;
  sortable?: boolean;
  renderCell?: (value: any, record: any) => React.ReactNode;
}

export interface ToolbarAction {
  label: string;
  icon?: string;
  color?: 'green' | 'gray' | 'red' | 'blue' | 'yellow' | 'purple';
  action: (helpers: TableHelpers) => void | Promise<void>;
}

export interface TableConfig {
  // Resource name for API calls (e.g., 'parameters', 'transcripts')
  resource: string;

  // Column definitions
  columns: ColumnConfig[];

  // Default column widths
  defaultWidths?: Record<string, number>;

  // Fields that should not be editable
  readOnlyFields?: string[];

  // Custom cell renderers
  customRenderers?: Record<string, (value: any, record: any, helpers: TableHelpers) => React.ReactNode>;

  // Bulk actions
  bulkActions?: BulkAction[];

  // Toolbar actions (buttons in the toolbar)
  toolbarActions?: ToolbarAction[];

  // Table settings
  settings?: {
    enableInlineEdit?: boolean;
    enableSorting?: boolean;
    enableColumnReorder?: boolean;
    enableColumnResize?: boolean;
    enableBulkSelect?: boolean;
  };
}

export interface BulkAction {
  label: string;
  color: 'green' | 'gray' | 'red' | 'blue' | 'yellow';
  action: (selectedIds: string[], helpers: TableHelpers) => Promise<void>;
}

export interface TableHelpers {
  refresh: () => void;
  notify: (message: string, options: { type: 'success' | 'error' | 'info' | 'warning' }) => void;
  dataProvider: any;
}
