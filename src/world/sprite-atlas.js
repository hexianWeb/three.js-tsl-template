export const ATLAS_COLUMNS = 5
export const ATLAS_ROWS = 7
export const ATLAS_FRAME_COUNT = ATLAS_COLUMNS * ATLAS_ROWS
const FRAME_COUNT = ATLAS_FRAME_COUNT
const INPUT_MIN = -0.9
const INPUT_MAX = 0.9

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
}

/**
 * @param {number} normalizedX
 */
export function getAtlasFrameFromNormalizedX(normalizedX) {
    const clamped = clamp(normalizedX, INPUT_MIN, INPUT_MAX)
    const progress = (clamped - INPUT_MIN) / (INPUT_MAX - INPUT_MIN)

    return Math.round(progress * (FRAME_COUNT - 1))
}

/**
 * Returns floating frame index in [0, FRAME_COUNT-1] for motion interpolation.
 * @param {number} normalizedX
 */
export function getAtlasFrameProgressFromNormalizedX(normalizedX) {
    const clamped = clamp(normalizedX, INPUT_MIN, INPUT_MAX)
    const progress = (clamped - INPUT_MIN) / (INPUT_MAX - INPUT_MIN)
    return progress * (FRAME_COUNT - 1)
}

/**
 * @param {number} frame
 */
export function getAtlasCellFromFrame(frame) {
    const clampedFrame = clamp(Math.round(frame), 0, FRAME_COUNT - 1)

    return {
        column: clampedFrame % ATLAS_COLUMNS,
        rowFromTop: Math.floor(clampedFrame / ATLAS_COLUMNS)
    }
}
