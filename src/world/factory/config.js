/**
 * Factory layout constants for the local simulation.
 * Dynamic state can be replaced later by a polling adapter.
 */
export const TANK_WIDTH_X = 8.57
export const TANK_SPACING_X = TANK_WIDTH_X * 1.2
export const TANK_COUNT = 49
/** Keep in sync with `FACTORY_CONFIG.tanks.originX`. */
export const TANK_ORIGIN_X = 0
export const TANK_MAX_X = TANK_ORIGIN_X + (TANK_COUNT - 1) * TANK_SPACING_X
export const TANK_LINE_HALF_X = (TANK_MAX_X - TANK_ORIGIN_X) / 2
export const FLYBAR_TANK_Y = -8
export const FLYBAR_CRANE_Y = 12

export const PROCESS_DATA = [
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
    { id: 49, name: '水洗' }
]

const BOILING_PROCESS_KEYWORDS = ['化抛', '热水洗', '碱咬']

export function getDefaultTankLiquidState(processName) {
    return BOILING_PROCESS_KEYWORDS.some((keyword) => processName.includes(keyword)) ? 'boiling' : 'calm'
}

export const FACTORY_CONFIG = {
    rails: {
        positions: [
            [0, 15, -26],
            [0,17.5+15,-26],
            [0,50,-26],
            [0, 15, 26],
        ]
    },
    tanks: {
        rows: 1,
        cols: TANK_COUNT,
        widthX: TANK_WIDTH_X,
        spacingX: TANK_SPACING_X,
        rowZ: [0],
        originX: TANK_ORIGIN_X,
        baseRoughness: 0.6,
        baseMetalness: 0.4,
        jitter: 0.2,
        /** 水槽主体着色用；调试面板可实时修改（与 GPU uniform 初始值一致）。 */
        tint: '#e5fffa',
        /** 温度超限告警视觉（槽体 mix、槽液、呼吸速度） */
        temperatureAlarm: {
            bodyMixColor: '#ff5533',
            liquidColor: '#ff4422',
            liquidOpacity: 0.62,
            breathRadPerSec: 2.2,
            /** 多个槽同时超限时，温度弹窗轮流展示的间隔（秒） */
            alertRotateSec: 4
        }
    },
    cranes: [
        {
            id: 'A',
            initialX: TANK_MAX_X * 0.22,
            initialY: 0,
            initialZ: 0,
            mode: 'auto',
            /** mock: 每车可行驶 X 区间（可由接口替换） */
            moveRange: { minX: TANK_ORIGIN_X, maxX: TANK_MAX_X * 0.33}
        },
        {
            id: 'B',
            initialX: TANK_MAX_X * 0.5,
            initialY: 0,
            initialZ: 0,
            mode: 'manual',
            moveRange: { minX: TANK_MAX_X * 0.34, maxX: TANK_MAX_X * 0.66 }
        },
        {
            id: 'C',
            initialX: TANK_MAX_X * 0.78,
            initialY: 0,
            initialZ: 0,
            mode: 'maintenance',
            moveRange: { minX: TANK_MAX_X * 0.67, maxX: TANK_MAX_X }
        }
    ],
    flybars: {
        count: 6
    },
    sim: {
        tickMs: 3000,
        modeRotateMs: 15000000
    },
    modeColors: {
        auto: '#22c55e',
        manual: '#eab308',
        maintenance: '#ef4444'
    }
}
