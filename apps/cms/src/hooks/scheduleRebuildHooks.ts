import { scheduleRebuild } from './rebuildWeb.ts'

// Attach to any collection/global's hooks.afterChange / hooks.afterDelete —
// structurally compatible with both collection and global hook signatures
// (Payload types both as `(args: { doc, ... }) => any`).
//
// Writes made with `context: { skipRebuild: true }` don't schedule one —
// for migrations, which run inside deploy.sh (it rebuilds the site itself
// right after migrating) in a short-lived process that shouldn't kick off a
// build of its own.
type HookArgs = { doc?: unknown; context?: { skipRebuild?: boolean } }

export const afterChangeTriggerRebuild = (args: HookArgs) => {
  if (!args?.context?.skipRebuild) scheduleRebuild()
  return args?.doc
}

export const afterDeleteTriggerRebuild = (args: HookArgs) => {
  if (!args?.context?.skipRebuild) scheduleRebuild()
  return args?.doc
}
