export * from './layout';
export * from './schemas';
export * from './session';
export * from './substitution.logic';
// clamp01 / isComplete / progress 在几个模板里同名，这里显式改名再导出
export { comboLevel, easedProgress, isTapComplete, pendingMilestones, progressFor, tapsNeeded } from './tap.logic';
export { findSlotAt, isCorrect, isPlaceComplete, placeProgress, slotFor } from './place.logic';
export * from './story.logic';
export * from './story';
export * from './substitution';
export * from './tap';
export * from './defineGame';
export * from './place';
// binFor / isCorrect / progress 在几个模板里同名，这里显式改名再导出
export { binAt, binFor, isSortComplete, isSortCorrect, needsTaste, nextUntasted, placedIn, probeHit, sortProgress } from './sort.logic';
export * from './sort';
// currentTarget / progress 在几个模板里同名，这里显式取名再导出
export { advanceTrace, currentAnchor, currentSegment, currentTarget, isTraceComplete, justFinishedSegment, traceProgress, traceStart } from './trace.logic';
export * from './trace';
// progress 在几个模板里同名，这里显式取名再导出
export { applyTemptation, effectiveDuration, isWaitDone, lineAt, waitProgress, waitRequired, waitStart } from './wait.logic';
export * from './wait';
// clamp01 在几个模板里同名，这里显式再导出
 export { aimDirection, distanceToSegment, firstHit, projectionT, pullAmount } from './aim.logic';
// aim 的阶梯（百步穿杨）用的辅助：找当前这一档的靶子
export { rungFor, rungTarget } from './aim.logic';
// clamp01 / mood 在几个模板里同名，这里显式取名再导出
export {
  driftOffset, foundWith, hintSurface, markResult, reachSword, surfaceAt, surfaceWorldX,
} from './mark.logic';
export * from './mark';
export {
  clampLeft, countsFor, dividerX, happyLeft, isGreedy, isSplitSolved, leftFromX, mood,
  moodLine, splitState, stepToward, watchedCount,
} from './split.logic';
export * from './split';
export {
  digState, escapeRoute, isBurrowOpen, neededBurrows, nextSpotToDig, openBurrows, spotAt,
  waveResult,
} from './burrow.logic';
export * from './burrow';
export * from './aim';
export * from './quiz';
export * from './reward';

/* ---------- 三十六计（第一辑 · 胜战计 1–6） ---------- */
export * from './ruse';
export * from './siege';
export * from './borrow';
export * from './stillness';
export * from './window';
// phaseAt 在 stillness 与 window 里同名、tapsNeeded 与 tap 里同名，这里显式改名再导出
export {
  RUSE_TIMING, autoplayLevel, gazeSide, isCarriedPast, isDisguised, isExposed, isRuseComplete,
  itemAt, lampIndex, lampPhase, litMsFor, msLitLeft, msToLight, nextItemToCarry, noiseAt,
  noiseForKnock, safeFor, shellAt, sideAt,
} from './ruse.logic';
export type { GazeSide, LampPhase, RuseSight, ShellPick } from './ruse.logic';
export {
  frontGain, frontTap, isRelieved, isSiegeDone, nextVital, relieve, resistanceOf, siegeProgress,
  siegeStart, tapsToFinish, untouchedVitals, vitalAt,
} from './siege.logic';
export type { SiegeState } from './siege.logic';
export {
  borrowStart, canLift, connectProp, disconnectProp, hasFulcrum, isBorrowDone, isLifted,
  nextPropToConnect, propAt, pull, selfPower, suggestedConnections, totalPower,
} from './borrow.logic';
export type { BorrowPull, BorrowState } from './borrow.logic';
export {
  STILLNESS_MIN_BEAT_MS, applyStrike, beatMarks, beatProgress, canStrikeAt, correctBeat,
  effectiveLevel, hitAction, isStillnessDone, remainingInBeatMs, slotAt, stillnessStart, strikeAt,
  phaseAt as stillnessPhaseAt, timeline as stillnessTimeline, totalMs as stillnessTotalMs,
} from './stillness.logic';
export type {
  BeatMark, BeatSlot, StillnessPhase, StillnessPhaseInfo, StillnessState, StrikeResult,
} from './stillness.logic';
export {
  WINDOW_MIN_PHASE_MS, WINDOW_WARN_MS, closeWindow, cycleIndexAt, cycleMs, doneCount, effectiveCycle,
  isJobDone, isWindowDone, jobAt, jobProgress, jobWork, nextJob, nextWindowInMs, phaseProgress,
  phaseRemainingMs, tapAt, tapJob, windowStart,
  phaseAt as windowPhaseAt, tapsNeeded as windowTapsNeeded,
} from './window.logic';
export type { WindowPhase, WindowState } from './window.logic';
