import mitt from 'mitt'
import { FACTORY_CONFIG, TANK_MAX_X, TANK_ORIGIN_X } from '../config.js'

/**
 * @returns {{
 *   cranes: Array<{ id: string, mode: string, status: string, x: number,
 *                   moveRange: { minX: number, maxX: number },
 *                   labelText: string, trackText: string,
 *                   carryingFlybarId: number|null,
 *                   task: { fromTankId: number, toTankId: number, flybarId: number } | null }>,
 *   tanks: Array<{ id: number, x: number, z: number, occupiedFlybarId: number|null }>,
 *   flybars: Array<{ id: number, location: { kind: 'tank'|'crane', tankId?: number, craneId?: string } }>,
 *   on: Function, off: Function, emit: Function
 * }}
 */
export function createFactoryState() {
    const emitter = mitt()

    const tanks = []
    let tid = 0
    for (let r = 0; r < FACTORY_CONFIG.tanks.rows; r++) {
        for (let c = 0; c < FACTORY_CONFIG.tanks.cols; c++) {
            tanks.push({
                id: tid++,
                x: FACTORY_CONFIG.tanks.originX + c * FACTORY_CONFIG.tanks.spacingX,
                z: FACTORY_CONFIG.tanks.rowZ[r],
                occupiedFlybarId: null
            })
        }
    }

    const cranes = FACTORY_CONFIG.cranes.map((c) => ({
        id: c.id,
        mode: c.mode,
        status: 'idle',
        x: c.initialX,
        moveRange: c.moveRange
            ? { minX: c.moveRange.minX, maxX: c.moveRange.maxX }
            : { minX: TANK_ORIGIN_X, maxX: TANK_MAX_X },
        labelText: c.id,
        trackText: '待机',
        carryingFlybarId: null,
        task: null
    }))

    const flybars = []
    const initialTankIds = pickFirstN(tanks.length, FACTORY_CONFIG.flybars.count)
    for (let i = 0; i < FACTORY_CONFIG.flybars.count; i++) {
        const tankId = initialTankIds[i]
        flybars.push({ id: i, location: { kind: 'tank', tankId } })
        tanks[tankId].occupiedFlybarId = i
    }

    return {
        cranes,
        tanks,
        flybars,
        on: emitter.on,
        off: emitter.off,
        emit: emitter.emit
    }
}

function pickFirstN(total, n) {
    const idx = []
    const step = Math.max(1, Math.floor(total / n))
    for (let i = 0; i < n; i++) idx.push((i * step) % total)
    return idx
}
