"use client";

import * as React from "react";
import {
  Create,
  SimpleForm,
  TextInput,
  BooleanInput,
  useRedirect,
  useResourceContext,
} from "react-admin";
import { Drawer } from "@mui/material";

export function ParameterCreateDrawer() {
  const redirect = useRedirect();
  const resource = useResourceContext();

  return (
    <Drawer
      anchor="right"
      open
      onClose={() => redirect(`/${resource}`)}
      sx={{
        "& .MuiDrawer-paper": {
          width: 480,
          padding: 2,
        },
      }}
    >
      <Create redirect={`/${resource}`}>
        <SimpleForm>
          <TextInput source="sectionId" />
          <TextInput source="parameterId" />
          <TextInput source="name" fullWidth />
          <TextInput source="domainGroup" />
          <BooleanInput source="isMvpCore" defaultValue={false} />
          <BooleanInput source="isActive" defaultValue={true} />
        </SimpleForm>
      </Create>
    </Drawer>
  );
}