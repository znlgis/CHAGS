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
  // support（釜底抽薪）/ close（关门捉贼）：第四辑扩出来的两个模式
  baseLog, closeExit, closeProgress, closeSchedule, closeStart, closedCount, closingExit, closingRatio,
  escapeExit, escapeLeftMs, exitAt, exitById, fireLevel, hasEscaped, isCloseDone, isExitClosed,
  isPulled, isSupportDone, logAt, logById, nextExitToClose, nextLogToPull, pullLog, pulledCount,
  roundElapsedMs, standingCount, supportProgress, supportStart,
} from './siege.logic';
export type { SiegeExit, SiegeState } from './siege.logic';
export {
  borrowStart, canLift, connectProp, disconnectProp, hasFulcrum, isBorrowDone, isLifted,
  nextPropToConnect, propAt, pull, selfPower, suggestedConnections, totalPower,
  // banner 模式（借尸还魂）：旗号能把散掉的人聚回来
  availableFlags, bannerStart, flagAt, isBannerDone, isFlagRaised, isPersonRallied, nextFlagToRaise,
  personAt, poleAt, raiseFlag, ralliedCount, ralliedRatio,
} from './borrow.logic';
export type { BannerRaise, BannerState, BorrowPull, BorrowState } from './borrow.logic';
export {
  STILLNESS_MIN_BEAT_MS, applyStrike, beatMarks, beatProgress, canStrikeAt, correctBeat,
  effectiveLevel, hitAction, isStillnessDone, remainingInBeatMs, slotAt, stillnessStart, strikeAt,
  phaseAt as stillnessPhaseAt, timeline as stillnessTimeline, totalMs as stillnessTotalMs,
} from './stillness.logic';
export type {
  BeatMark, BeatSlot, StillnessPhase, StillnessPhaseInfo, StillnessState, StrikeResult,
} from './stillness.logic';
export {
  WINDOW_MIN_PHASE_MS, WINDOW_WARN_MS, closeWindow, currentJob, cycleIndexAt, cycleMs, doneCount,
  effectiveCycle, isJobDone, isTravelOver, isWindowDone, jobAt, jobProgress, jobWork, nextJob,
  nextWindowInMs, phaseProgress, phaseRemainingMs, restartTravel, tapAt, tapJob, travelFloorMs,
  travelLeftMs, windowStart,
  // stir（混水摸鱼）：窗口是自己搅出来的
  MURK_MAX, isMuddy, muddyLeftMs, murkAt, stirAt, stirStart,
  phaseAt as windowPhaseAt, tapsNeeded as windowTapsNeeded,
} from './window.logic';
export type { MurkState, StirWindowLevel, WindowPhase, WindowState } from './window.logic';

/* ---------- 三十六计（第二辑 · 敌战计 7–12） ---------- */
export * from './show';
export * from './twoline';
export * from './read';
export * from './matchup';
// isExposed 在 ruse（示形）与 twoline（双线）里同名、autoplayLevel 在 ruse 与 read 里同名：
// 语义不同，这里显式改名再导出，免得两处共用一个名字
export {
  SHOW_RATES, aliveShadowIds, aliveShadows, beliefAt, beliefRate, isShadowAlive, isShowDone,
  missingShadows, nextSlotToPaint, paint, paintedAtMs, shadowLeftMs, shadowStrength, showStart,
  tick,
  slotAt as showSlotAt,
} from './show.logic';
export type { ShowState } from './show.logic';
export {
  TWOLINE_TIMING, decoyNow, decoyRatio, hitDecoy, hitReal, needsTopUp, nextLineToTap, realRatio,
  safeMsLeft, settleDecoy, tapDecoy, tapReal, tapsLeft, twolineStart,
  isExposed as isDecoyExposed, isTwolineDone,
} from './twoline.logic';
export type { TwolineState } from './twoline.logic';
export {
  READ_TIMING, applyMiss, applyRead, isReadDone, isTellRead, nextTellAt, nextTellToRead, readGoal,
  readMisses, readProgress, readStart, tellAt, tellAtSlot, tellLeftMs, tellNear, tellSlots,
  tellsSoFar,
  autoplayLevel as readAutoplayLevel,
} from './read.logic';
export type { ReadState, TellSlot } from './read.logic';
export {
  MATCHUP_TIMING, RIVAL_HIT, assign, bestRoster, bestWins, horseAtSlot, horseNear, isMatchupDone,
  isRosterFull, lossesFor, matchupProgress, pairings, placements, powerGap, resetRoster, resolve,
  rivalAt, scaledMs, slotOfHorse, takeBack, winsFor, winsNeeded,
  // order（远交近攻）：一圈势力，近的先解决、远的先结好
  MATCHUP_ORDER_TIMING, expectedNext, isOrderDone, neighborAt, neighborsInOrder, nextIdInOrder,
  noteWrongPick, orderProgress, orderStart, pick, pickedCount, pickedOrder, wrongPicks,
} from './matchup.logic';
export type { OrderState, RaceResult, Roster } from './matchup.logic';

/* ---------- 三十六计（第三辑 · 攻战计 13–18） ---------- */
export * from './probe';
export * from './lure';
export * from './chase';
// tick 在 show（造势）与 chase（追而不逼）里同名：语义不同，这里改名再导出
export {
  PROBE_TIMING, canCross, cross, crossablePatches, figureAt, figureById, hasSnake, isFigureTried,
  isKingFigure, isKnockDone, isKnocked, isSpooked, knock, knockOrder, nextFigureToShoot,
  nextKnockStep, nextPatchToKnock, patchById, probeAt, probeStart, remainingFigures, shoot,
} from './probe.logic';
export type { KnockLevel, ProbeState, ProbeStep, SpotLevel } from './probe.logic';
export {
  LURE_TIMING, awayLeftMs, awayTotalMs, baitAt, baitById, baitsLongEnough, bestBait, bestOffer,
  decoyStart, give, givenReturnFor, grabAt, grabProgress, guardBack, isAway, isDecoyDone,
  isTradeDone, lureAutoplayLevel, lureStart, nextOfferToGive, offerAt, offerById, offerFor,
  placeBait, prizeHit, releaseGrab, tradeProgress, tradeStart,
} from './lure.logic';
export type {
  LureDecoyLevel, LureDecoyState, LureState, LureTradeLevel, LureTradeState,
} from './lure.logic';
export {
  CHASE_MAX_DISTANCE, CHASE_TIMING, bandOf, chaseAutoplayLevel, chaseMid, chaseStart, distanceBand,
  hitHold, holdWanted, isChaseDone, lostCount, progressRatio, pushyCount, staminaRatio,
  tick as chaseTick,
} from './chase.logic';
export type { ChaseBand, ChaseState } from './chase.logic';

/* ---------- 三十六计（第四辑 · 混战计 19–24） ---------- */
export * from './swap';
export * from './chain';
export {
  SWAP_TIMING, canPlace, caughtPosts, gateHit, hasLeft, isAllSwapped, isPostSwapped, isShellDone,
  leave, leftAtMs, nextPeekInMs, nextPostToSwap, nextSwapStep, peek, peekCount, placeSpare,
  postAt, postById, seenCount, spareAt, spareById, spareFor, spareOf, spareStandingAt, swapCount,
  swapOrder, swapStart, unswappedPosts, usableSpares,
} from './swap.logic';
export type { SwapState, SwapStep } from './swap.logic';
export {
  CHAIN_TIMING, askPass, chainStart, chainStep, envoyHit, gateAt, gateById, gatesLeft, hasPass,
  hasReturnedHome, homeHit, isAllGatesTaken, isGateTaken, isNextGate, isPassDone, nextGate,
  returnHome, takeGate, takenCount,
} from './chain.logic';
export type { ChainState, ChainStep } from './chain.logic';
