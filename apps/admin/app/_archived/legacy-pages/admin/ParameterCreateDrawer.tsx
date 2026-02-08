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
          <TextInput source="parameterId" label="Parameter ID" required />
          <TextInput source="name" label="Name" fullWidth required />
          <TextInput source="domainGroup" label="Domain Group" required />
          <TextInput source="sectionId" label="Section ID" required />
          <TextInput source="scaleType" label="Scale Type" required />
          <TextInput source="directionality" label="Directionality" required />
          <TextInput source="computedBy" label="Computed By" />
          <TextInput source="definition" label="Definition" multiline fullWidth rows={3} />
          <TextInput source="interpretationLow" label="Interpretation (Low)" />
          <TextInput source="interpretationHigh" label="Interpretation (High)" />
          <TextInput source="measurementMvp" label="Measurement (MVP)" />
          <TextInput source="measurementVoiceOnly" label="Measurement (Voice Only)" />
        </SimpleForm>
      </Create>
    </Drawer>
  );
}