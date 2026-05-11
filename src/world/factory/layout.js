/**
 * Pure factory layout data. Keep this file free of Three.js imports so layout
 * rules can be tested with Node's built-in test runner.
 */
export const TANK_WIDTH_X = 8.57
export const TANK_SPACING_X = TANK_WIDTH_X * 1.2
export const TANK_ORIGIN_X = 0
export const ROW_GAP_Z = 175

export const TANK_ROWS = [
    {
        id: 'top',
        z: -ROW_GAP_Z / 2,
        numbers: rangeAscending(1, 50)
    },
    {
        id: 'bottom',
        z: ROW_GAP_Z / 2,
        numbers: rangeDescending(102, 52)
    }
]

export const TANK_LAYOUT = TANK_ROWS.flatMap((row) =>
    row.numbers.map((number, col) => ({
        number,
        rowId: row.id,
        col,
        x: TANK_ORIGIN_X + col * TANK_SPACING_X,
        z: row.z
    }))
)

export const TANK_COUNT = TANK_LAYOUT.length
export const TANK_MAX_COLS = Math.max(...TANK_ROWS.map((row) => row.numbers.length))
export const TANK_MAX_X = TANK_ORIGIN_X + (TANK_MAX_COLS - 1) * TANK_SPACING_X
export const TANK_LINE_HALF_X = (TANK_MAX_X - TANK_ORIGIN_X) / 2

const IMAGE_REVIEW_TANKS = new Set(rangeAscending(52, 102))

const PROCESS_DATA_RAW = [
    { id: 1, name: '上料' },
    { id: 2, name: '交换车' },
    { id: 3, name: '烘干' },
    { id: 4, name: '烘干' },
    { id: 5, name: '碱咬' },
    { id: 6, name: '水洗' },
    { id: 7, name: '上料' },
    { id: 8, name: '上料' },
    { id: 9, name: '水洗' },
    { id: 10, name: '脱酯' },
    { id: 11, name: '脱酯' },
    { id: 12, name: '水洗' },
    { id: 13, name: '顶喷水洗' },
    { id: 14, name: '剥黑膜' },
    { id: 15, name: '水洗' },
    { id: 16, name: '顶喷水洗' },
    { id: 17, name: '碱咬' },
    { id: 18, name: '脱酯' },
    { id: 19, name: '水洗' },
    { id: 20, name: '闲置' },
    { id: 21, name: '化抛A' },
    { id: 22, name: '热水洗' },
    { id: 23, name: '化抛B' },
    { id: 24, name: '水洗' },
    { id: 25, name: '顶喷水洗' },
    { id: 26, name: '周转水洗' },
    { id: 27, name: '剥黑膜' },
    { id: 28, name: '顶喷水洗' },
    { id: 29, name: '热水洗' },
    { id: 30, name: '化抛C' },
    { id: 31, name: '顶喷水洗' },
    { id: 32, name: '水洗' },
    { id: 33, name: '测光泽' },
    { id: 34, name: '水洗' },
    { id: 35, name: '顶喷水洗' },
    { id: 36, name: '废液' },
    { id: 37, name: '剥黑膜' },
    { id: 38, name: '水洗' },
    { id: 39, name: '水洗' },
    { id: 40, name: '陶化' },
    { id: 41, name: '化抛D' },
    { id: 42, name: '热水洗' },
    { id: 43, name: '顶喷水洗' },
    { id: 44, name: '水洗' },
    { id: 45, name: '剥黑膜' },
    { id: 46, name: '顶喷水洗' },
    { id: 47, name: '水洗' },
    { id: 48, name: '测光泽' },
    { id: 49, name: '交换车' },
    { id: 50, name: '交换车' },
    { id: 52, name: '交换车' },
    { id: 53, name: '水洗' },
    { id: 54, name: '水洗' },
    { id: 55, name: '水洗' },
    { id: 56, name: '阳极氧化' },
    { id: 57, name: '阴极氧化' },
    { id: 58, name: '水洗' },
    { id: 59, name: '水洗' },
    { id: 60, name: '水洗' },
    { id: 61, name: '回收' },
    { id: 62, name: '回收' },
    { id: 63, name: '水洗' },
    { id: 64, name: '水洗' },
    { id: 65, name: '测光泽' },
    { id: 66, name: '水洗' },
    { id: 67, name: '水洗' },
    { id: 68, name: '水洗' },
    { id: 69, name: '水洗' },
    { id: 70, name: '水洗' },
    { id: 71, name: '水洗' },
    { id: 72, name: '水洗' },
    { id: 73, name: '水洗' },
    { id: 74, name: '水洗' },
    { id: 75, name: '化抛' },
    { id: 76, name: '周转水洗' },
    { id: 77, name: '水洗' },
    { id: 78, name: '周转水洗' },
    { id: 79, name: '水洗' },
    { id: 80, name: '水洗' },
    { id: 81, name: '水洗' },
    { id: 82, name: '水洗' },
    { id: 83, name: '水洗' },
    { id: 84, name: '水洗' },
    { id: 85, name: '水洗' },
    { id: 86, name: '顶喷水洗' },
    { id: 87, name: '水洗' },
    { id: 88, name: '水洗' },
    { id: 89, name: '水洗' },
    { id: 90, name: '水洗' },
    { id: 91, name: '水洗' },
    { id: 92, name: '热水洗' },
    { id: 93, name: '烘干' },
    { id: 94, name: '烘干' },
    { id: 95, name: '中转' },
    { id: 96, name: '中转' },
    { id: 97, name: '中转' },
    { id: 98, name: '下料' },
    { id: 99, name: '下料' },
    { id: 100, name: '下料' },
    { id: 101, name: '交换车' },
    { id: 102, name: '下料' }
]

export const PROCESS_DATA = TANK_LAYOUT.map((slot) => {
    const process = PROCESS_DATA_RAW.find((item) => item.id === slot.number)
    return {
        id: slot.number,
        name: process?.name ?? '',
        needsReview: process?.needsReview ?? IMAGE_REVIEW_TANKS.has(slot.number)
    }
})

export const PROCESS_DATA_BY_TANK = new Map(PROCESS_DATA.map((item) => [item.id, item]))

export const CRANE_LAYOUT = TANK_ROWS.flatMap((row, rowIndex) => {
    const segmentCount = 5
    const segmentSize = Math.ceil(row.numbers.length / segmentCount)

    return Array.from({ length: segmentCount }, (_, segmentIndex) => {
        const startCol = segmentIndex * segmentSize
        const endCol = Math.min(row.numbers.length - 1, startCol + segmentSize - 1)
        const minX = TANK_ORIGIN_X + startCol * TANK_SPACING_X - TANK_SPACING_X / 2
        const maxX = TANK_ORIGIN_X + endCol * TANK_SPACING_X + TANK_SPACING_X / 2
        const initialX = TANK_ORIGIN_X + ((startCol + endCol) / 2) * TANK_SPACING_X
        const ordinal = rowIndex * segmentCount + segmentIndex + 1

        return {
            id: String.fromCharCode(64 + ordinal),
            rowId: row.id,
            initialX,
            initialY: 0,
            initialZ: row.z,
            mode: 'auto',
            moveRange: {
                minX: Math.max(TANK_ORIGIN_X, minX),
                maxX: Math.min(TANK_MAX_X, maxX)
            }
        }
    })
})

function rangeAscending(start, end) {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function rangeDescending(start, end) {
    return Array.from({ length: start - end + 1 }, (_, i) => start - i)
}
