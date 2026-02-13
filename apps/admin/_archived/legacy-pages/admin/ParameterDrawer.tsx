"use client";

import * as React from "react";
import {
  Edit,
  SimpleForm,
  TextInput,
  BooleanInput,
  useRedirect,
  useResourceContext,
} from "react-admin";
import { Drawer } from "@mui/material";

export function ParameterEditDrawer() {
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
      <Edit
        mutationMode="pessimistic"
        redirect={`/${resource}`}
      >
        <SimpleForm>
          <TextInput source="sectionId" />
          <TextInput source="parameterId" />
          <TextInput source="name" fullWidth />
          <TextInput source="domainGroup" />
          <BooleanInput source="isMvpCore" />
          <BooleanInput source="isActive" />
        </SimpleForm>
      </Edit>
    </Drawer>
  );
}