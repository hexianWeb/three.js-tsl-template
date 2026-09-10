export function createAnimationClock(epochMs = Date.now()) {
  const epoch = Number.isFinite(Number(epochMs)) ? Number(epochMs) : Date.now()

  return {
    epochMs: epoch,
    elapsed() {
      return Math.max(0, (Date.now() - epoch) / 1000)
    },
  }
}
