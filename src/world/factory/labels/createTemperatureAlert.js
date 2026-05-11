import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

/**
 * 背景：`/img/error_dialog.png`；正文排版同 `temperature_warning_compact.html`。
 * 外层 `tank-temp-css2d` 供 CSS2D 挂接；内层 `tank-temperature-alert` 做底部锚点偏移。
 * 多槽同时超限时，`TankField` 会轮流将对应 `CSS2DObject.visible` 置为 true，避免叠在一起。
 * @param {{ id: number, x: number, z: number }} tank
 */
export function createTemperatureAlert(tank) {
    const root = document.createElement('div')
    root.className = 'tank-temp-css2d'

    const wrap = document.createElement('div')
    wrap.className = 'tank-temperature-alert'

    const card = document.createElement('div')
    card.className = 'alert-card'
    card.setAttribute('role', 'alert')
    card.setAttribute('aria-label', '温度预警')

    const header = document.createElement('div')
    header.className = 'alert-header'

    const title = document.createElement('span')
    title.className = 'alert-title'
    title.textContent = '温度预警'
    header.appendChild(title)

    const body = document.createElement('div')
    body.className = 'alert-body'

    const rowTank = document.createElement('div')
    rowTank.className = 'tank-temp-row'
    const labTank = document.createElement('span')
    labTank.className = 'row-label'
    labTank.textContent = '槽体'
    const tankIdEl = document.createElement('span')
    tankIdEl.className = 'row-value'
    rowTank.append(labTank, tankIdEl)

    const divider1 = document.createElement('div')
    divider1.className = 'divider'

    const rowCur = document.createElement('div')
    rowCur.className = 'tank-temp-row tank-temp-row--current'
    const labCur = document.createElement('span')
    labCur.className = 'row-label'
    labCur.textContent = '当前温度'
    const currentEl = document.createElement('span')
    currentEl.className = 'row-value hot'
    rowCur.append(labCur, currentEl)

    const barTrack = document.createElement('div')
    barTrack.className = 'bar-track'
    const barFill = document.createElement('div')
    barFill.className = 'bar-fill'
    barTrack.appendChild(barFill)

    const thRow = document.createElement('div')
    thRow.className = 'threshold-row'
    const labTh = document.createElement('span')
    labTh.className = 'row-label'
    labTh.textContent = '阈值'
    const thresholdEl = document.createElement('span')
    thresholdEl.className = 'threshold-value'
    thRow.append(labTh, thresholdEl)

    const divider2 = document.createElement('div')
    divider2.className = 'divider divider--loose'

    const statusLine = document.createElement('div')
    statusLine.className = 'status-line'
    const dot = document.createElement('div')
    dot.className = 'dot'
    const statusEl = document.createElement('span')
    statusEl.className = 'status-text'
    statusLine.append(dot, statusEl)

    body.append(rowTank, divider1, rowCur, barTrack, thRow, divider2, statusLine)
    card.append(header, body)
    wrap.appendChild(card)
    root.appendChild(wrap)

    const object = new CSS2DObject(root)
    object.position.set(tank.x, 15, tank.z - 27)
    object.visible = false

    return { object, tankIdEl, currentEl, thresholdEl, barFill, statusEl }
}

/**
 * @param {{
 *   tankIdEl: HTMLSpanElement,
 *   currentEl: HTMLSpanElement,
 *   thresholdEl: HTMLSpanElement,
 *   barFill: HTMLDivElement,
 *   statusEl: HTMLSpanElement
 * }} alert
 * @param {{ numberText?: string, temperatureC?: number|null, temperatureLimitC?: number|null }} tank
 * @param {boolean} over
 */
export function updateTemperatureAlert(alert, tank, over) {
    const curNum = tank.temperatureC
    const limNum = tank.temperatureLimitC

    alert.tankIdEl.textContent = (tank.numberText && String(tank.numberText).trim()) || '--'
    alert.currentEl.textContent = formatTempC(curNum)
    if (limNum != null && !Number.isNaN(Number(limNum))) {
        alert.thresholdEl.textContent = `${Number(limNum).toFixed(1)}°C ⚠️`
    } else {
        alert.thresholdEl.textContent = '--'
    }
    if (over && curNum != null && limNum != null) {
        const delta = Number(curNum) - Number(limNum)
        alert.statusEl.textContent = `超限 +${delta.toFixed(1)}°C`
    } else {
        alert.statusEl.textContent = ''
    }
    if (curNum != null && limNum != null && Number(limNum) > 0) {
        const pct = Math.min(100, (Number(curNum) / Number(limNum)) * 100)
        alert.barFill.style.width = `${pct}%`
    } else {
        alert.barFill.style.width = '0%'
    }
}

/**
 * @param {number|null|undefined} v
 */
function formatTempC(v) {
    if (v == null || Number.isNaN(Number(v))) {
        return '--'
    }
    return `${Number(v).toFixed(1)}°C`
}
