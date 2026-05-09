import { FACTORY_CONFIG } from './config.js'

const NEXT_MODE = { auto: 'manual', manual: 'maintenance', maintenance: 'auto' }

export default class FactoryController {
    /**
     * @description 工厂控制器
     * @param {ReturnType<typeof import('./state/FactoryState.js').createFactoryState>} state 工厂状态
     * @param {Map<string, import('./entities/Crane.js').default>} cranesById 天车
     * @param {import('./entities/Flybar.js').FlybarPool} flybarPool 飞杆池
     * @param {import('./entities/TankField.js').default} tankField 水槽场
     */
    constructor(state, cranesById, flybarPool, tankField) {
        this.state = state
        this.cranes = cranesById
        this.flybarPool = flybarPool
        this.tankField = tankField

        this._acc = 0
        this._modeAcc = 0
        this._paused = false
        this._reservedTanks = new Set()
        this._reservedFlybars = new Set()
    }

    pause() {
        this._paused = true
    }

    resume() {
        this._paused = false
    }

    update(dt) {
        if (this._paused) return
        this._acc += dt * 1000
        this._modeAcc += dt * 1000

        if (this._acc >= FACTORY_CONFIG.sim.tickMs) {
            this._acc = 0
            this._tick()
        }
        if (this._modeAcc >= FACTORY_CONFIG.sim.modeRotateMs) {
            this._modeAcc = 0
            this._rotateRandomMode()
        }
    }

    _tick() {
        for (const cs of this.state.cranes) {
            if (cs.status !== 'idle' || cs.task) continue
            const task = this._draftTaskForCrane(cs)
            if (!task) continue

            cs.task = task
            cs.status = 'moving'
            cs.trackText = `前往 ${this.state.tanks[task.fromTankId].numberText}`
            this._reservedFlybars.add(task.flybarId)
            this._reservedTanks.add(task.toTankId)

            this._runCraneTask(cs).catch((err) => {
                console.warn(`[FactoryController] crane ${cs.id} task failed`, err)
                cs.status = 'idle'
                cs.trackText = '等待任务'
                cs.carryingFlybarId = null
                this._releaseTask(cs)
            })
        }
    }

    /**
     * @description 为天车派单
     * @param {{ moveRange: { minX: number, maxX: number } }} cs 天车
     * @returns {{ fromTankId: number, toTankId: number, flybarId: number } | null} 派单结果
     */
    _draftTaskForCrane(cs) {
        const { minX, maxX } = cs.moveRange
        const tanks = this.state.tanks
        const inRange = (x) => x >= minX && x <= maxX

        const candidates = []
        for (const t of tanks) {
            if (t.occupiedFlybarId == null) continue
            if (this._reservedFlybars.has(t.occupiedFlybarId)) continue
            if (!inRange(t.x)) continue
            candidates.push(t.id)
        }
        if (!candidates.length) return null
        const fromTankId = candidates[Math.floor(Math.random() * candidates.length)]
        const flybarId = tanks[fromTankId].occupiedFlybarId

        const empties = []
        for (const t of tanks) {
            if (t.id === fromTankId) continue
            if (t.occupiedFlybarId != null) continue
            if (this._reservedTanks.has(t.id)) continue
            if (!inRange(t.x)) continue
            empties.push(t.id)
        }
        if (!empties.length) return null
        const toTankId = empties[Math.floor(Math.random() * empties.length)]
        return { fromTankId, toTankId, flybarId }
    }

    /**
     * @description 运行天车任务
     * @param {{ id: string, task: { fromTankId: number, toTankId: number, flybarId: number } }} cs 天车
     */
    async _runCraneTask(cs) {
        const crane = this.cranes.get(cs.id)
        if (!crane) return this._releaseTask(cs)
        const { fromTankId, toTankId, flybarId } = cs.task
        const fromTank = this.state.tanks[fromTankId]
        const toTank = this.state.tanks[toTankId]
        if (fromTank.occupiedFlybarId !== flybarId) return this._releaseTask(cs)
        const flybar = this.flybarPool.get(flybarId)

        await crane.moveToX(fromTank.x)
        cs.status = 'picking'
        cs.trackText = '取飞杆'
        await crane.pickFlybar(flybar)
        fromTank.occupiedFlybarId = null
        cs.carryingFlybarId = flybarId
        this.state.flybars[flybarId].location = { kind: 'crane', craneId: cs.id }

        cs.status = 'carrying'
        cs.trackText = `前往 ${toTank.numberText}`
        await crane.moveToX(toTank.x)

        cs.status = 'dropping'
        cs.trackText = '下飞杆'
        await crane.dropFlybar(this.tankField.getAnchor(toTankId))
        toTank.occupiedFlybarId = flybarId
        cs.carryingFlybarId = null
        this.state.flybars[flybarId].location = { kind: 'tank', tankId: toTankId }

        cs.status = 'idle'
        cs.trackText = '等待任务'
        this._releaseTask(cs)
    }

    /**
     * @description 释放天车任务
     * @param {{ id: string, task: { fromTankId: number, toTankId: number, flybarId: number } }} cs 天车
     */
    _releaseTask(cs) {
        if (!cs.task) return
        this._reservedFlybars.delete(cs.task.flybarId)
        this._reservedTanks.delete(cs.task.toTankId)
        cs.task = null
    }

    /**
     * @description 随机切换天车模式
     */
    _rotateRandomMode() {
        const cs = this.state.cranes[Math.floor(Math.random() * this.state.cranes.length)]
        const next = NEXT_MODE[cs.mode] ?? 'auto'
        cs.mode = next
        this.state.emit('mode-changed', { id: cs.id, mode: next })
        const crane = this.cranes.get(cs.id)
        crane?.setMode(next)
    }
}
