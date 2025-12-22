import {
  List,
  Datagrid,
  TextField,
  BooleanField,
  Edit,
  Create,
  SimpleForm,
  TextInput,
  BooleanInput,
} from "react-admin";

export const ParameterList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="parameterId" />
      <TextField source="name" />
      <TextField source="domainGroup" />
      <BooleanField source="isActive" />
      <BooleanField source="isMvpCore" />
    </Datagrid>
  </List>
);

export const ParameterEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="parameterId" />
      <TextInput source="name" />
      <TextInput source="domainGroup" />
      <TextInput source="sectionId" />
      <BooleanInput source="isActive" />
      <BooleanInput source="isMvpCore" />
    </SimpleForm>
  </Edit>
);

export const ParameterCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="parameterId" />
      <TextInput source="name" />
      <TextInput source="domainGroup" />
      <TextInput source="sectionId" />
      <BooleanInput source="isActive" />
      <BooleanInput source="isMvpCore" />
    </SimpleForm>
  </Create>
);
