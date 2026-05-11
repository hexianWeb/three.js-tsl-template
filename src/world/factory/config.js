/**
 * Factory layout constants for the local simulation.
 * Dynamic state can be replaced later by a polling adapter.
 */
import {
    CRANE_LAYOUT,
    PROCESS_DATA,
    PROCESS_DATA_BY_TANK,
    TANK_COUNT,
    TANK_LAYOUT,
    TANK_LINE_HALF_X,
    TANK_MAX_COLS,
    TANK_MAX_X,
    TANK_ORIGIN_X,
    TANK_ROWS,
    TANK_SPACING_X,
    TANK_WIDTH_X
} from './layout.js'

export {
    CRANE_LAYOUT,
    PROCESS_DATA,
    PROCESS_DATA_BY_TANK,
    TANK_COUNT,
    TANK_LAYOUT,
    TANK_LINE_HALF_X,
    TANK_MAX_COLS,
    TANK_MAX_X,
    TANK_ORIGIN_X,
    TANK_ROWS,
    TANK_SPACING_X,
    TANK_WIDTH_X
}

export const FLYBAR_TANK_Y = -8
export const FLYBAR_CRANE_Y = 12

const BOILING_PROCESS_KEYWORDS = ['化抛', '热水洗', '碱咬']

export function getDefaultTankLiquidState(processName) {
    return BOILING_PROCESS_KEYWORDS.some((keyword) => processName.includes(keyword)) ? 'boiling' : 'calm'
}

export const FACTORY_CONFIG = {
    rails: {
        rowOffsets: [
            [0, 15, -26],
            [0, 17.5 + 15, -26],
            [0, 50, -26],
            [0, 15, 26]
        ]
    },
    tanks: {
        rows: TANK_ROWS.length,
        cols: TANK_MAX_COLS,
        widthX: TANK_WIDTH_X,
        spacingX: TANK_SPACING_X,
        rowZ: TANK_ROWS.map((row) => row.z),
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
    cranes: CRANE_LAYOUT,
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
