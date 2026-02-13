/**
 * Shared types for the Spec Config Editor system.
 */

export type ControlType =
  | "boolean_toggle"
  | "number_slider"
  | "number_stepper"
  | "number_input"
  | "text_input"
  | "text_area"
  | "template_editor"
  | "tag_list"
  | "weight_map"
  | "string_map"
  | "range_editor"
  | "object_list"
  | "nested_object"
  | "raw_json";

export interface ConfigFieldDef {
  key: string;
  value: unknown;
  controlType: ControlType;
  path: string[];
}

export interface ConfigGroup {
  name: string;
  fields: ConfigFieldDef[];
  collapsed: boolean;
}
