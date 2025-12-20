"use client";

import {
  Admin,
  Resource,
  List,
  Datagrid,
  TextField,
  BooleanField,
  EditButton,
  Edit,
  Create,
  SimpleForm,
  TextInput,
  BooleanInput,
  required,
  SearchInput,
} from "react-admin";
import { dataProvider } from "./dataProvider";

const filters = [
  <SearchInput key="q" source="q" alwaysOn />,
  <TextInput key="sectionId" source="sectionId" label="Section" />,
];

function ParameterList() {
  return (
    <List filters={filters} perPage={25} sort={{ field: "updatedAt", order: "DESC" }}>
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
}

function ParameterEdit() {
  return (
    <Edit>
      <SimpleForm>
        <TextInput source="parameterId" disabled />
        <TextInput source="sectionId" validate={required()} />
        <TextInput source="domainGroup" validate={required()} />
        <TextInput source="name" validate={required()} fullWidth />
        <TextInput source="definition" multiline fullWidth />
        <TextInput source="measurementMvp" multiline fullWidth />
        <TextInput source="measurementVoiceOnly" multiline fullWidth />
        <TextInput source="interpretationHigh" multiline fullWidth />
        <TextInput source="interpretationLow" multiline fullWidth />
        <TextInput source="scaleType" />
        <TextInput source="directionality" />
        <TextInput source="computedBy" />
        <BooleanInput source="isMvpCore" />
        <BooleanInput source="isActive" />
      </SimpleForm>
    </Edit>
  );
}

function ParameterCreate() {
  return (
    <Create>
      <SimpleForm>
        <TextInput source="parameterId" helperText="Must be unique (slug-like)." validate={required()} />
        <TextInput source="sectionId" validate={required()} />
        <TextInput source="domainGroup" validate={required()} />
        <TextInput source="name" validate={required()} fullWidth />
        <TextInput source="definition" multiline fullWidth />
        <TextInput source="measurementMvp" multiline fullWidth />
        <TextInput source="measurementVoiceOnly" multiline fullWidth />
        <TextInput source="interpretationHigh" multiline fullWidth />
        <TextInput source="interpretationLow" multiline fullWidth />
        <TextInput source="scaleType" />
        <TextInput source="directionality" />
        <TextInput source="computedBy" />
        <BooleanInput source="isMvpCore" defaultValue={false} />
        <BooleanInput source="isActive" defaultValue={true} />
      </SimpleForm>
    </Create>
  );
}

export default function AdminPage() {
  return (
    <Admin dataProvider={dataProvider}>
      <Resource name="parameters" list={ParameterList} edit={ParameterEdit} create={ParameterCreate} />
    </Admin>
  );
}