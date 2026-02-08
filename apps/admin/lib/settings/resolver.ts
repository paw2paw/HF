/**
 * Settings Resolver
 *
 * Resolves $ref references in agent settingsSchema by looking up definitions
 * in the settings library.
 */

import { SettingsLibrary, SettingDefinition } from './library-schema';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolve all $ref references in a schema object
 */
export function resolveSchemaRefs(
  schema: any,
  library: SettingsLibrary
): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Handle $ref
  if (schema.$ref && typeof schema.$ref === 'string') {
    const refPath = schema.$ref.replace('#/settings/', '');
    const definition = library.settings[refPath];

    if (!definition) {
      console.warn(`[Settings Resolver] Reference not found: ${schema.$ref}`);
      return schema;
    }

    // Convert setting definition to JSON Schema
    return settingToJsonSchema(definition);
  }

  // Handle arrays
  if (Array.isArray(schema)) {
    return schema.map(item => resolveSchemaRefs(item, library));
  }

  // Handle objects
  const resolved: any = {};
  for (const [key, value] of Object.entries(schema)) {
    resolved[key] = resolveSchemaRefs(value, library);
  }
  return resolved;
}

/**
 * Convert a SettingDefinition to JSON Schema format
 */
export function settingToJsonSchema(setting: SettingDefinition): any {
  const base: any = {
    title: setting.title,
    description: setting.description,
  };

  switch (setting.type) {
    case 'number':
      return {
        ...base,
        type: 'number',
        default: setting.default,
        minimum: setting.minimum,
        maximum: setting.maximum,
      };

    case 'string':
    case 'path':
      return {
        ...base,
        type: 'string',
        default: setting.default,
        ...(setting.type === 'string' && setting.pattern ? { pattern: setting.pattern } : {}),
        ...(setting.type === 'string' && setting.minLength ? { minLength: setting.minLength } : {}),
        ...(setting.type === 'string' && setting.maxLength ? { maxLength: setting.maxLength } : {}),
      };

    case 'boolean':
      return {
        ...base,
        type: 'boolean',
        default: setting.default,
      };

    case 'enum':
      return {
        ...base,
        type: 'string',
        enum: setting.enum,
        default: setting.default,
      };

    case 'array':
      return {
        ...base,
        type: 'array',
        items: setting.items,
        default: setting.default,
        minItems: setting.minItems,
        maxItems: setting.maxItems,
      };

    default:
      return base;
  }
}

/**
 * Load settings library from file system
 */
export async function loadSettingsLibrary(
  libraryPath: string
): Promise<SettingsLibrary | null> {
  try {
    const content = await fs.readFile(libraryPath, 'utf-8');
    return JSON.parse(content) as SettingsLibrary;
  } catch (error) {
    return null;
  }
}

/**
 * Save settings library to file system
 */
export async function saveSettingsLibrary(
  libraryPath: string,
  library: SettingsLibrary
): Promise<void> {
  await fs.mkdir(path.dirname(libraryPath), { recursive: true });
  await fs.writeFile(
    libraryPath,
    JSON.stringify(
      {
        ...library,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf-8'
  );
}

/**
 * Get default settings library path
 */
export function getSettingsLibraryPath(kbRoot: string): string {
  return path.join(kbRoot, '.hf', 'settings-library.json');
}

/**
 * Extract default values from resolved schema
 */
export function extractDefaultsFromSchema(schema: any): Record<string, any> {
  if (!schema?.properties) return {};

  const defaults: Record<string, any> = {};

  for (const [key, prop] of Object.entries(schema.properties)) {
    if (typeof prop === 'object' && prop !== null && 'default' in prop) {
      defaults[key] = (prop as any).default;
    }
  }

  return defaults;
}
