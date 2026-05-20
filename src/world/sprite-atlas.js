export const ATLAS_COLUMNS = 6
export const ATLAS_ROWS = 6
export const ATLAS_FRAME_COUNT = ATLAS_COLUMNS * ATLAS_ROWS
const FRAME_COUNT = ATLAS_FRAME_COUNT
const INPUT_MIN = -1
const INPUT_MAX = 1

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
export function getAtlasFrameFromNormalizedX(normalizedX, columns = ATLAS_COLUMNS, rows = ATLAS_ROWS) {
    const frameCount = columns * rows
    const clamped = clamp(normalizedX, INPUT_MIN, INPUT_MAX)
    const progress = (clamped - INPUT_MIN) / (INPUT_MAX - INPUT_MIN)
    
    return Math.round(progress * (frameCount - 1))
}

/**
 * Returns floating frame index in [0, FRAME_COUNT-1] for motion interpolation.
 * @param {number} normalizedX
 */
export function getAtlasFrameProgressFromNormalizedX(normalizedX, columns = ATLAS_COLUMNS, rows = ATLAS_ROWS) {
    const frameCount = columns * rows
    const clamped = clamp(normalizedX, INPUT_MIN, INPUT_MAX)
    const progress = (clamped - INPUT_MIN) / (INPUT_MAX - INPUT_MIN)
    return progress * (frameCount - 1)
}

/**
 * @param {number} frame
 */
export function getAtlasCellFromFrame(frame, columns = ATLAS_COLUMNS) {
    const clampedFrame = clamp(Math.round(frame), 0, Infinity) // upper bound handled by caller

    return {
        column: clampedFrame % columns,
        rowFromTop: Math.floor(clampedFrame / columns)
    }
}
