# Admin Table System

Reusable, configurable table system for all admin CRUD pages with inline editing, sorting, resizing, reordering, and bulk actions.

## Quick Start

### 1. Create a Table Configuration

Create a config file in `/app/admin/configs/`:

```typescript
// /app/admin/configs/myResourceTableConfig.tsx
import type { TableConfig } from '../shared/InlineEditableTableConfig';

export const myResourceTableConfig: TableConfig = {
  resource: 'myResource',

  columns: [
    { field: 'id', label: 'ID', width: 100, editable: false, sortable: true },
    { field: 'name', label: 'Name', width: 200, editable: true, sortable: true },
    { field: 'status', label: 'Status', width: 150, editable: false, sortable: true }
  ],

  readOnlyFields: ['id', 'createdAt', 'updatedAt'],

  bulkActions: [
    {
      label: 'Delete Selected',
      color: 'red',
      action: async (selectedIds, helpers) => {
        if (!confirm(`Delete ${selectedIds.length} items?`)) return;
        await Promise.all(
          selectedIds.map(id =>
            helpers.dataProvider.delete('myResource', { id, previousData: {} })
          )
        );
        helpers.notify(`Deleted ${selectedIds.length} items`, { type: 'success' });
        helpers.refresh();
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
```

### 2. Create the Resource Page

```typescript
// /app/admin/myresource/page.tsx
"use client";

import { Admin, Resource } from 'react-admin';
import simpleRestProvider from 'ra-data-simple-rest';
import { AdminListPage } from '../shared/AdminListPage';
import { myResourceTableConfig } from '../configs/myResourceTableConfig';

const dataProvider = simpleRestProvider('/api');

export default function MyResourcePage() {
  return (
    <Admin dataProvider={dataProvider}>
      <Resource
        name="myResource"
        list={() => (
          <AdminListPage
            config={myResourceTableConfig}
            perPage={50}
            defaultSort={{ field: 'id', order: 'ASC' }}
            searchable
          />
        )}
      />
    </Admin>
  );
}
```

## Features

### Inline Editing
- Click any editable cell to edit in place
- Press Enter to save, Escape to cancel
- Textarea for long fields like 'definition'

### Column Management
- **Resize**: Drag column borders
- **Reorder**: Drag column headers (⋮⋮ icon)
- **Sort**: Click headers (Shift+click for multi-column)
- All preferences saved to localStorage

### Bulk Actions
- Select rows with checkboxes
- Custom bulk actions defined in config
- Built-in clear selection

### Custom Renderers
Add custom cell rendering in your config:

```typescript
customRenderers: {
  status: (value, record, helpers) => {
    return (
      <span style={{
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: value === 'active' ? '#10b981' : '#6b7280',
        color: 'white'
      }}>
        {value}
      </span>
    );
  }
}
```

### Styling

Immutable keys (id, parameterId) are displayed as:
- Bold (font-weight: 600)
- Black text (#111827)

Read-only fields are displayed as:
- Medium weight (font-weight: 500)
- Gray text (#6b7280)

Editable fields are displayed as:
- Normal weight (font-weight: 400)
- Black text (#111827)

## API Requirements

Your API endpoints should follow React-Admin conventions:

- `GET /api/myResource` - List with pagination
- `GET /api/myResource/:id` - Get single item
- `POST /api/myResource` - Create
- `PUT /api/myResource/:id` - Update
- `DELETE /api/myResource/:id` - Delete

## Examples

See `/app/admin/configs/parametersTableConfig.tsx` for a complete example with:
- Custom renderers (Status pills)
- Tag management
- Multiple bulk actions
- All table features enabled
