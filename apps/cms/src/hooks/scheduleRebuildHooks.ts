import { scheduleRebuild } from './rebuildWeb.ts'

// Attach to any collection/global's hooks.afterChange / hooks.afterDelete —
// structurally compatible with both collection and global hook signatures
// (Payload types both as `(args: { doc, ... }) => any`).
export const afterChangeTriggerRebuild = (args: { doc?: unknown }) => {
  scheduleRebuild()
  return args?.doc
}

export const afterDeleteTriggerRebuild = (args: { doc?: unknown }) => {
  scheduleRebuild()
  return args?.doc
}
