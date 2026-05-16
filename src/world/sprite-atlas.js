const ATLAS_COLUMNS = 5
const ATLAS_ROWS = 7
const FRAME_COUNT = ATLAS_COLUMNS * ATLAS_ROWS
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
 * @param {number} frame
 */
export function getAtlasUvTransform(frame) {
    const clampedFrame = clamp(Math.round(frame), 0, FRAME_COUNT - 1)
    const column = clampedFrame % ATLAS_COLUMNS
    const rowFromTop = Math.floor(clampedFrame / ATLAS_COLUMNS)

    return {
        repeatX: 1 / ATLAS_COLUMNS,
        repeatY: 1 / ATLAS_ROWS,
        offsetX: column / ATLAS_COLUMNS,
        offsetY: (ATLAS_ROWS - 1 - rowFromTop) / ATLAS_ROWS
    }
}
