/**
 * Group config keys into Essential (always visible) and Advanced (collapsed sections).
 */
import type { ConfigFieldDef, ConfigGroup, ControlType } from "./types";
import { inferControlType } from "./inferControlType";
import { humanizeKey } from "./humanizeKey";

const ESSENTIAL_KEY_PATTERN = /^(include|enable|default|temperature)/i;
const ESSENTIAL_STEPPER_PATTERN = /limit|max|min|count|retries|perCategory|per_category/i;

function isEssential(key: string, controlType: ControlType): boolean {
  if (controlType === "boolean_toggle") return true;
  if (controlType === "number_slider") return true;
  if (controlType === "number_stepper" && ESSENTIAL_STEPPER_PATTERN.test(key)) return true;
  if (ESSENTIAL_KEY_PATTERN.test(key)) return true;
  return false;
}

function fieldSummary(fields: ConfigFieldDef[]): string {
  const n = fields.length;
  if (n === 0) return "";
  const types = new Set(fields.map((f) => f.controlType));
  if (types.has("weight_map") || types.has("string_map")) return `${n} entries`;
  if (types.has("object_list")) return `${n} items`;
  return `${n} ${n === 1 ? "setting" : "settings"}`;
}

export function groupConfigKeys(config: Record<string, unknown>): ConfigGroup[] {
  const essential: ConfigFieldDef[] = [];
  const advanced = new Map<string, ConfigFieldDef[]>();

  for (const [key, value] of Object.entries(config)) {
    const controlType = inferControlType(key, value);
    const field: ConfigFieldDef = { key, value, controlType, path: [key] };

    if (isEssential(key, controlType)) {
      essential.push(field);
    } else {
      // Each non-essential key becomes its own collapsible section
      const groupName = humanizeKey(key);
      if (!advanced.has(groupName)) advanced.set(groupName, []);
      advanced.get(groupName)!.push(field);
    }
  }

  const groups: ConfigGroup[] = [];

  if (essential.length > 0) {
    groups.push({ name: "Essentials", fields: essential, collapsed: false });
  }

  for (const [name, fields] of advanced.entries()) {
    groups.push({
      name: `${name} (${fieldSummary(fields)})`,
      fields,
      collapsed: true,
    });
  }

  return groups;
}
