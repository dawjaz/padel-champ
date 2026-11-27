/**
 * When a touch really happened, on the scene clock (ms).
 *
 * A timing ring judges the moment of the touch. The touch handler runs only when the browser gets to it: after the frame being drawn,
 * often 30 to 130 ms after the finger landed on a busy phone (measured: 128 ms in a slow headless browser). Reading the scene clock in
 * the handler therefore judged good touches as late ("TOO LATE" when the ring was green). The touch event carries its own time stamp
 * on the performance clock, and Phaser's scene clock (`scene.time.now`) runs on that same clock (`performance.now()` at the start of
 * each frame), so the stamp is the moment to judge.
 *
 * `stamp` is `pointer.event.timeStamp`; a stamp that does not look like the performance clock (in the future, or older than
 * `MAX_TOUCH_AGE`: an old browser's epoch time, a stale event) falls back to the scene clock as before.
 */
export const MAX_TOUCH_AGE = 300;

export function touchTime(clockNow: number, perfNow: number, stamp: number | undefined): number {
  if (stamp === undefined || !Number.isFinite(stamp)) return clockNow;
  const ago = perfNow - stamp;
  if (ago < -1 || ago > MAX_TOUCH_AGE) return clockNow;
  return Math.min(stamp, perfNow);
}

/** The time stamp of a Phaser pointer's DOM event, if it has one. */
export const eventStamp = (pointer: { event?: { timeStamp?: number } } | undefined): number | undefined => pointer?.event?.timeStamp;
