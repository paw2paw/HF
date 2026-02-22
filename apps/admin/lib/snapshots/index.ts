/**
 * Snapshot System
 *
 * Database snapshot management — take, list, restore, delete.
 * See snapshot-config.ts for layer definitions and table ordering.
 */

export {
  // Config & types
  SNAPSHOTS_DIR,
  LAYER_0_TABLES,
  LAYER_1_TABLES,
  LAYER_2_TABLES,
  LAYER_3_TABLES,
  SKIPPED_TABLES,
  TRUNCATION_ORDER,
  INSERTION_ORDER,
  isValidSnapshotName,
  getTablesForLayers,
  type SnapshotMetadata,
  type SnapshotFile,
  type SnapshotInfo,
  type TakeSnapshotOptions,
  type RestoreSnapshotOptions,
  type RestoreResult,
  type ProgressCallback,
} from "./snapshot-config";

// Take
export { takeSnapshot, startSnapshotTakeJob } from "./snapshot-take";

// List / Get / Delete
export {
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  loadSnapshotFile,
} from "./snapshot-list";

// Restore
export { restoreSnapshot, startSnapshotRestoreJob } from "./snapshot-restore";
