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
} from "react-admin";

import simpleRestProvider from "ra-data-simple-rest";
import { ParameterEditDrawer } from "./ParameterDrawer";
import { ParameterCreateDrawer } from "./ParameterCreateDrawer";

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

const ParameterList = () => (
  <List
    perPage={25}
    sort={{ field: "updatedAt", order: "DESC" }}
    filters={[
      <TextInput key="q" source="q" label="Search" alwaysOn />,
      <BooleanInput key="isActive" source="isActive" />,
      <BooleanInput key="isMvpCore" source="isMvpCore" />,
    ]}
  >
    <Datagrid rowClick="edit">
      <TextField source="sectionId" />
      <TextField source="parameterId" />
      <TextField source="name" />
      <TextField source="domainGroup" />
      <BooleanField source="isMvpCore" />
      <BooleanField source="isActive" />
      <EditButton />
    </Datagrid>
  </List>
);

const ParameterEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="sectionId" />
      <TextInput source="parameterId" />
      <TextInput source="name" fullWidth />
      <TextInput source="domainGroup" />
      <BooleanInput source="isMvpCore" />
      <BooleanInput source="isActive" />
    </SimpleForm>
  </Edit>
);

const ParameterCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="sectionId" />
      <TextInput source="parameterId" />
      <TextInput source="name" fullWidth />
      <TextInput source="domainGroup" />
      <BooleanInput source="isMvpCore" defaultValue={false} />
      <BooleanInput source="isActive" defaultValue={true} />
    </SimpleForm>
  </Create>
);

/* -----------------------------
   Admin App
-------------------------------- */

export default function AdminApp() {
  return (
    <Admin dataProvider={dataProvider}>
      <Resource
        name="parameters"
        list={ParameterList}
        edit={ParameterEditDrawer}
        create={ParameterCreateDrawer}
      />
    </Admin>
  );
}