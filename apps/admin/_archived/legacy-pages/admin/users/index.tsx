import {
  List,
  Datagrid,
  TextField,
  Edit,
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanField,
  BooleanInput,
} from "react-admin";

export const UserList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="email" />
      <TextField source="role" />
      <BooleanField source="isActive" />
    </Datagrid>
  </List>
);

export const UserEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="email" />
      <SelectInput
        source="role"
        choices={[
          { id: "SUPERADMIN", name: "SUPERADMIN" },
          { id: "ADMIN", name: "ADMIN" },
        ]}
      />
      <BooleanInput source="isActive" />
    </SimpleForm>
  </Edit>
);

export const UserCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="email" />
      <SelectInput
        source="role"
        choices={[
          { id: "SUPERADMIN", name: "SUPERADMIN" },
          { id: "ADMIN", name: "ADMIN" },
        ]}
      />
      <BooleanInput source="isActive" defaultValue />
    </SimpleForm>
  </Create>
);
