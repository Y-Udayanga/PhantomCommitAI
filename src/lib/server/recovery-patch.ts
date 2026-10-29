import "server-only";
import {
  applyPatch,
  createTwoFilesPatch,
  parsePatch,
  reversePatch,
} from "diff";
import { maskSecrets, safePath } from "../forensics";
import type { FileChange } from "../types";
/** Reverse only the selected historical file diff, then re-diff the exact current snapshot. */
export function recoveryPatch(
  file: FileChange,
  current: string,
  source: string,
  base: string,
  branch: string,
) {
  if (
    !safePath(file.file_path) ||
    (file.previous_path && file.previous_path !== file.file_path)
  )
    throw new Error(
      "Renamed paths require manual placement; a reliable automatic proposal is unavailable.",
    );
  if (file.diff_truncated || !file.patch_excerpt || !file.deletions)
    throw new Error(
      "Complete deletion evidence is required to generate a patch.",
    );
  if (
    current.length > 150000 ||
    maskSecrets(current) !== current ||
    maskSecrets(file.patch_excerpt) !== file.patch_excerpt
  )
    throw new Error(
      "Recovery withheld because source is too large or contains a possible secret.",
    );
  const historical = parsePatch(
    `--- a/${file.file_path}\n+++ b/${file.file_path}\n${file.patch_excerpt}\n`,
  );
  if (historical.length !== 1 || !historical[0].hunks.length)
    throw new Error("Invalid historical diff.");
  const reversed = reversePatch(historical[0]);
  const proposed = applyPatch(current, reversed, {
    fuzzFactor: 0,
    autoConvertLineEndings: false,
  });
  if (proposed === false || proposed === current)
    throw new Error(
      "Historical context does not match the selected base. Manual adaptation is required.",
    );
  const patch = createTwoFilesPatch(
    `a/${file.file_path}`,
    `b/${file.file_path}`,
    current,
    proposed,
    undefined,
    undefined,
    { context: 3 },
  );
  validateRecoveryPatch(patch, file.file_path, current);
  return {
    patch,
    proposed: maskSecrets(proposed),
    source,
    base,
    branch,
    validation:
      "Exact context application checked in memory; no code executed. Reverses the entire selected file change, including its additions. Review all changes, dependencies and compatibility before applying.",
  };
}
export function validateRecoveryPatch(
  patch: string,
  path: string,
  current: string,
) {
  if (
    !safePath(path) ||
    patch.length > 350000 ||
    maskSecrets(patch) !== patch ||
    /GIT binary patch|^diff --git|^rename |^new mode|^old mode/m.test(patch)
  )
    throw new Error("Unsafe patch.");
  const parsed = parsePatch(patch);
  if (
    parsed.length !== 1 ||
    parsed[0].oldFileName !== `a/${path}` ||
    parsed[0].newFileName !== `b/${path}` ||
    !parsed[0].hunks.length ||
    applyPatch(current, parsed[0], {
      fuzzFactor: 0,
      autoConvertLineEndings: false,
    }) === false
  )
    throw new Error("Patch cannot apply to this base.");
  return true;
}
