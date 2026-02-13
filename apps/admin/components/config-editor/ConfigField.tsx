"use client";

import { inferControlType } from "./utils/inferControlType";
import { humanizeKey } from "./utils/humanizeKey";
import { BooleanToggle } from "./controls/BooleanToggle";
import { NumberSlider } from "./controls/NumberSlider";
import { NumberStepper } from "./controls/NumberStepper";
import { NumberInput } from "./controls/NumberInput";
import { TextInput } from "./controls/TextInput";
import { TemplateEditor } from "./controls/TemplateEditor";
import { TagListEditor } from "./controls/TagListEditor";
import { WeightMapEditor } from "./controls/WeightMapEditor";
import { StringMapEditor } from "./controls/StringMapEditor";
import { RangeEditor } from "./controls/RangeEditor";
import { ObjectListEditor } from "./controls/ObjectListEditor";
import { NestedObjectEditor } from "./controls/NestedObjectEditor";
import { RawJsonFallback } from "./controls/RawJsonFallback";

const MAX_DEPTH = 3;

interface ConfigFieldProps {
  fieldKey: string;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  depth?: number;
}

/**
 * Dispatcher: infers the best control type from key + value,
 * then renders the matching control component.
 */
export function ConfigField({ fieldKey, value, onChange, disabled, depth = 0 }: ConfigFieldProps) {
  const label = humanizeKey(fieldKey);

  // Beyond max depth, always fall back to JSON
  if (depth >= MAX_DEPTH && typeof value === "object" && value !== null) {
    return <RawJsonFallback label={label} value={value} onChange={onChange} disabled={disabled} />;
  }

  const controlType = inferControlType(fieldKey, value);

  switch (controlType) {
    case "boolean_toggle":
      return <BooleanToggle label={label} value={value as boolean} onChange={onChange} disabled={disabled} />;

    case "number_slider":
      return <NumberSlider label={label} value={value as number} onChange={onChange} disabled={disabled} />;

    case "number_stepper":
      return <NumberStepper label={label} value={value as number} onChange={onChange} disabled={disabled} />;

    case "number_input":
      return <NumberInput label={label} value={value as number} onChange={onChange} disabled={disabled} />;

    case "text_input":
      return <TextInput label={label} value={value as string} onChange={onChange} disabled={disabled} />;

    case "text_area":
      return <TextInput label={label} value={value as string} onChange={onChange} disabled={disabled} multiline />;

    case "template_editor":
      return <TemplateEditor label={label} value={value as string} onChange={onChange} disabled={disabled} />;

    case "tag_list":
      return <TagListEditor label={label} value={value as string[]} onChange={onChange} disabled={disabled} />;

    case "weight_map":
      return (
        <WeightMapEditor
          label={label}
          value={value as Record<string, number>}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "string_map":
      return (
        <StringMapEditor
          label={label}
          value={value as Record<string, string>}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "range_editor":
      return (
        <RangeEditor
          label={label}
          value={value as { min: number; max: number }}
          onChange={onChange}
          disabled={disabled}
        />
      );

    case "object_list":
      return (
        <ObjectListEditor
          label={label}
          value={value as Record<string, unknown>[]}
          onChange={onChange}
          disabled={disabled}
          depth={depth}
        />
      );

    case "nested_object":
      return (
        <NestedObjectEditor
          label={label}
          value={value as Record<string, unknown>}
          onChange={onChange}
          disabled={disabled}
          depth={depth}
        />
      );

    case "raw_json":
    default:
      return <RawJsonFallback label={label} value={value} onChange={onChange} disabled={disabled} />;
  }
}
