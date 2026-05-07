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

export const FACTORY_CONFIG = {
    rails: {
        positions: [
            [0, 15, -26],
            [0, 15, 26]
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
        jitter: 0.1
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
        tickMs: 1000,
        modeRotateMs: 15000
    },
    modeColors: {
        auto: '#22c55e',
        manual: '#eab308',
        maintenance: '#ef4444'
    }
}
