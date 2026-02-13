/**
 * Infer the best UI control type from a config key name and its runtime value.
 * No schema needed — heuristics handle 95% of cases.
 */
import type { ControlType } from "./types";

const SLIDER_KEY_PATTERN = /alpha|confidence|weight|temperature|factor|ratio|score/i;
const STEPPER_KEY_PATTERN = /limit|max|min|count|retries|per_category|perCategory/i;

export function inferControlType(key: string, value: unknown): ControlType {
  if (value === null || value === undefined) return "raw_json";

  if (typeof value === "boolean") return "boolean_toggle";

  if (typeof value === "number") {
    if (
      SLIDER_KEY_PATTERN.test(key) ||
      (value >= 0 && value <= 1 && !Number.isInteger(value))
    ) {
      return "number_slider";
    }
    if (Number.isInteger(value) && value >= 0 && value < 100) return "number_stepper";
    return "number_input";
  }

  if (typeof value === "string") {
    if (value.includes("{") && value.includes("}")) return "template_editor";
    if (value.length > 200) return "text_area";
    return "text_input";
  }

  if (Array.isArray(value)) {
    if (value.length === 0 || typeof value[0] === "string") return "tag_list";
    if (typeof value[0] === "object") return "object_list";
    return "raw_json";
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return "raw_json";

    // Range: { min, max } with number values
    if (
      "min" in obj &&
      "max" in obj &&
      typeof obj.min === "number" &&
      typeof obj.max === "number"
    ) {
      return "range_editor";
    }

    // All-number record → weight map equalizer
    if (entries.length > 0 && entries.every(([, v]) => typeof v === "number")) {
      return "weight_map";
    }

    // All-string record → key-value pair editor
    if (entries.length > 0 && entries.every(([, v]) => typeof v === "string")) {
      return "string_map";
    }

    return "nested_object";
  }

  return "raw_json";
}
