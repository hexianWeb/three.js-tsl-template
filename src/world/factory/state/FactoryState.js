import mitt from 'mitt'
import { FACTORY_CONFIG, PROCESS_DATA, TANK_MAX_X, TANK_ORIGIN_X, getDefaultTankLiquidState } from '../config.js'

/**
 * @description 工厂状态
 * @returns {{
 *   cranes: Array<{ id: string, mode: string, status: string, x: number,
 *                   moveRange: { minX: number, maxX: number },
 *                   labelText: string, trackText: string,
 *                   carryingFlybarId: number|null,
 *                   task: { fromTankId: number, toTankId: number, flybarId: number } | null }>,
 *   tanks: Array<{ id: number, numberText: string, processName: string, liquidState: string,
 *                  x: number, z: number, occupiedFlybarId: number|null,
 *                  temperatureC: number|null, temperatureLimitC: number|null }>,
 *   flybars: Array<{ id: number, location: { kind: 'tank'|'crane', tankId?: number, craneId?: string }, isEmpty: boolean }>,
 *   on: Function, off: Function, emit: Function
 * }}
 */
export function createFactoryState() {
    const emitter = mitt()

    const tanks = []
    let tid = 0
    for (let r = 0; r < FACTORY_CONFIG.tanks.rows; r++) {
        for (let c = 0; c < FACTORY_CONFIG.tanks.cols; c++) {
            const process = PROCESS_DATA[tid]
            tanks.push({
                id: tid++,
                numberText: `${process?.id ?? tid}#`,
                processName: process?.name ?? '',
                liquidState: getDefaultTankLiquidState(process?.name ?? ''),
                x: FACTORY_CONFIG.tanks.originX + c * FACTORY_CONFIG.tanks.spacingX,
                z: FACTORY_CONFIG.tanks.rowZ[r],
                occupiedFlybarId: null,
                temperatureC: null,
                temperatureLimitC: null
            })
        }
    }

    applyMockTankTemperatures(tanks)

    const cranes = FACTORY_CONFIG.cranes.map((crane) => ({
        id: crane.id,
        mode: crane.mode,
        status: 'idle',
        x: crane.initialX,
        moveRange: crane.moveRange
            ? { minX: crane.moveRange.minX, maxX: crane.moveRange.maxX }
            : { minX: TANK_ORIGIN_X, maxX: TANK_MAX_X },
        labelText: crane.id,
        trackText: '等待任务',
        carryingFlybarId: null,
        task: null
    }))

    const flybars = []
    const initialTankIds = pickFirstN(tanks.length, FACTORY_CONFIG.flybars.count)
    for (let i = 0; i < FACTORY_CONFIG.flybars.count; i++) {
        const tankId = initialTankIds[i]
        // isEmpty: true = 空杆(闲置中), false = 挂载物品(浸泡中)
        const isEmpty = Math.random() > 0.5
        flybars.push({ id: i, location: { kind: 'tank', tankId }, isEmpty })
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

/**
 * 本地 mock：2 个正常、2 个超限、1 个等于上限（不超限），其余默认温和区间。
 * @param {Array<{ id: number, temperatureC: number|null, temperatureLimitC: number|null }>} tanks
 */
function applyMockTankTemperatures(tanks) {
    for (const t of tanks) {
        if (t.id === 0 || t.id === 1) {
            t.temperatureC = 55
            t.temperatureLimitC = 60
        } else if (t.id === 2 || t.id === 3) {
            t.temperatureC = 72
            t.temperatureLimitC = 60
        } else if (t.id === 4) {
            t.temperatureC = 60
            t.temperatureLimitC = 60
        } else {
            t.temperatureC = 48 + (t.id % 7)
            t.temperatureLimitC = 65
        }
    }
}

/**
 * 选取一个等步长的索引数组，返回长度为 n，步长分布在 total 内的下标，用于初始分布抓取器于各罐
 * @param {number} total 总元素数
 * @param {number} n 需要选取的数量
 * @returns {number[]} 下标数组
 */
function pickFirstN(total, n) {
    const idx = []
    const step = Math.max(1, Math.floor(total / n))
    for (let i = 0; i < n; i++) idx.push((i * step) % total)
    return idx
}
