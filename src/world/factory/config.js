/**
 * Factory layout constants for the local simulation.
 * Dynamic state can be replaced later by a polling adapter.
 */
export const TANK_WIDTH_X = 8.57
export const TANK_SPACING_X = TANK_WIDTH_X * 1.2
export const TANK_COUNT = 49
export const TANK_LINE_HALF_X = ((TANK_COUNT - 1) * TANK_SPACING_X) / 2
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
        originX: 0,
        baseRoughness: 0.6,
        baseMetalness: 0.4,
        jitter: 0.1
    },
    cranes: [
        { id: 'A', initialX: TANK_LINE_HALF_X - 30, initialY: 0, initialZ: 0, mode: 'auto' },
        { id: 'B', initialX: TANK_LINE_HALF_X, initialY: 0, initialZ: 0, mode: 'manual' },
        { id: 'C', initialX: TANK_LINE_HALF_X + 30, initialY: 0, initialZ: 0, mode: 'maintenance' }
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
