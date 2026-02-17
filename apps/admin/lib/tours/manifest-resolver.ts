/**
 * Manifest Resolver
 *
 * Resolves stable manifest item IDs to current href/label/icon values.
 * Tours reference item IDs instead of hardcoding hrefs — when the sidebar
 * manifest changes, tours follow automatically.
 */

import manifest from "@/lib/sidebar/sidebar-manifest.json";

interface ManifestItemInfo {
  id: string;
  href: string;
  label: string;
  icon?: string;
  sectionId: string;
  roleVariants?: Record<string, { label?: string; href?: string; icon?: string }>;
}

export interface ResolvedItem {
  href: string;
  label: string;
  icon?: string;
  sectionId: string;
}

// Build lookup map once at module load
const ITEM_MAP = new Map<string, ManifestItemInfo>();

for (const section of manifest) {
  for (const item of section.items) {
    if ((item as any).id) {
      ITEM_MAP.set((item as any).id, {
        id: (item as any).id,
        href: item.href,
        label: item.label,
        icon: item.icon,
        sectionId: section.id,
        roleVariants: (item as any).roleVariants,
      });
    }
  }
}

/**
 * Resolve a manifest item ID to its current info.
 * Pass a role to resolve role-variant overrides (e.g. EDUCATOR → classrooms href).
 */
export function resolveManifestItem(
  itemId: string,
  role?: string,
): ResolvedItem | null {
  const info = ITEM_MAP.get(itemId);
  if (!info) return null;

  if (role && info.roleVariants?.[role]) {
    const variant = info.roleVariants[role];
    return {
      href: variant.href ?? info.href,
      label: variant.label ?? info.label,
      icon: variant.icon ?? info.icon,
      sectionId: info.sectionId,
    };
  }

  return {
    href: info.href,
    label: info.label,
    icon: info.icon,
    sectionId: info.sectionId,
  };
}

/** All known manifest item IDs (for validation). */
export function getAllManifestItemIds(): string[] {
  return Array.from(ITEM_MAP.keys());
}
