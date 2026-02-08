"use client";

import * as React from "react";
import {
  Admin,
  Resource,
  List,
  Datagrid,
  TextField,
  BooleanField,
  TextInput,
  BooleanInput,
  Edit,
  Create,
  SimpleForm,
  EditButton,
  FunctionField,
  useListContext,
  Layout,
  LayoutProps,
} from "react-admin";

import simpleRestProvider from "ra-data-simple-rest";
import { ParameterEditDrawer } from "./ParameterDrawer";
import { ParameterCreateDrawer } from "./ParameterCreateDrawer";
import { InlineEditableTable } from "./InlineEditableTable";
import { AdminListPage } from "./shared/AdminListPage";
import { parametersTableConfig } from "./configs/parametersTableConfig";

/**
 * Custom layout that removes React-Admin's navigation chrome
 * Integrates with the existing sidebar navigation in the app
 */
const CustomLayout = ({ children }: LayoutProps) => (
  <div style={{ padding: '0' }}>
    {children}
  </div>
);

// Custom field component for status tags
const StatusField = ({ record }: any) => {
  if (!record || !record.tags) return null;

  const tagNames = record.tags.map((t: any) => t.tag?.name).filter(Boolean);
  const isActive = tagNames.some((name: string) => name.toLowerCase() === 'active');
  const isMvpCore = tagNames.some((name: string) => name.toLowerCase() === 'mvp' || name.toLowerCase() === 'mvpcore');

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {isActive ? (
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: '#10b981',
          color: 'white'
        }}>
          Active
        </span>
      ) : (
        <span style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '600',
          backgroundColor: '#6b7280',
          color: 'white'
        }}>
          Inactive
        </span>
      )}
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
 * React Admin REST provider
 * Matches:
 *   /api/parameters
 *   /api/parameters/:id
 */
const dataProvider = simpleRestProvider("/api");

/* -----------------------------
   Parameter resources
-------------------------------- */

// All available Parameter fields from the database schema
const ALL_PARAMETER_FIELDS = [
  'id',
  'parameterId',
  'sectionId',
  'domainGroup',
  'name',
  'definition',
  'measurementMvp',
  'measurementVoiceOnly',
  'interpretationHigh',
  'interpretationLow',
  'scaleType',
  'directionality',
  'computedBy',
  'tags',
  'promptSlugLinks',
  'createdAt',
  'updatedAt'
];

const ParameterList = () => (
  <AdminListPage
    config={parametersTableConfig}
    allFields={ALL_PARAMETER_FIELDS}
    perPage={50}
    defaultSort={{ field: 'parameterId', order: 'ASC' }}
    searchable
  />
);

const ParameterEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="parameterId" disabled label="Parameter ID" />
      <TextInput source="name" fullWidth />
      <TextInput source="domainGroup" label="Domain Group" />
      <TextInput source="sectionId" label="Section/Model" />
      <TextInput source="scaleType" label="Scale Type" />
      <TextInput source="directionality" label="Directionality" />
      <TextInput source="computedBy" label="Computed By" />
      <TextInput source="definition" multiline fullWidth rows={3} />
      <TextInput source="interpretationLow" label="Interpretation (Low)" />
      <TextInput source="interpretationHigh" label="Interpretation (High)" />
      <TextInput source="measurementMvp" label="Measurement (MVP)" />
      <TextInput source="measurementVoiceOnly" label="Measurement (Voice Only)" />
    </SimpleForm>
  </Edit>
);

const ParameterCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="parameterId" required />
      <TextInput source="name" required fullWidth />
      <TextInput source="sectionId" required />
      <TextInput source="domainGroup" required />
      <TextInput source="scaleType" required label="Scale Type" />
      <TextInput source="directionality" required />
      <TextInput source="computedBy" required label="Computed By" />
      <TextInput source="definition" multiline fullWidth rows={3} />
      <TextInput source="interpretationLow" label="Interpretation (Low)" />
      <TextInput source="interpretationHigh" label="Interpretation (High)" />
      <TextInput source="measurementMvp" label="Measurement (MVP)" />
      <TextInput source="measurementVoiceOnly" label="Measurement (Voice Only)" />
    </SimpleForm>
  </Create>
);

/* -----------------------------
   Admin App
-------------------------------- */

export default function AdminApp() {
  return (
    <Admin dataProvider={dataProvider} layout={CustomLayout}>
      <Resource
        name="parameters"
        list={ParameterList}
        edit={ParameterEditDrawer}
        create={ParameterCreateDrawer}
      />
    </Admin>
  );
}