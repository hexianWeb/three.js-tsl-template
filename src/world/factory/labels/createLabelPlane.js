import * as THREE from 'three/webgpu'

/**
 * @param {{
 *   width: number,
 *   height: number,
 *   canvasW?: number,
 *   canvasH?: number,
 *   draw: (ctx: CanvasRenderingContext2D, text: string) => void
 * }} options
 */
export function createLabelPlane({ width, height, canvasW = 256, canvasH = 256, draw }) {
    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4

    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false ,side: THREE.DoubleSide})
    const mesh = new THREE.Mesh(geometry, material)

    let lastText = null
    function setText(text) {
        if (text === lastText) return
        lastText = text
        ctx.clearRect(0, 0, canvasW, canvasH)
        draw(ctx, text)
        texture.needsUpdate = true
    }

    function dispose() {
        geometry.dispose()
        material.dispose()
        texture.dispose()
    }

    return { mesh, setText, dispose }
}

export function drawLabel(ctx, text) {
    const { width, height } = ctx.canvas
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 240px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text ?? '', width / 2, height / 2 + 8)
}

export function drawTankNumber(ctx, text) {
    const { width, height } = ctx.canvas
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 150px "Bahnschrift"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text ?? '', width / 2, height / 2)
}

/**
 * 温度条：`cur|lim|over` — over 为 `1` 时红橙底（超限），`0` 时浅底；lim 空表示无上限仅显示当前。
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 */
export function drawTankTemperature(ctx, text) {
    const { width, height } = ctx.canvas
    const parts = (text ?? '').split('|')
    const cur = parts[0] ?? ''
    const lim = parts[1] ?? ''
    const over = parts[2] === '1'
    const curDisp = cur === '' ? '--' : cur

    if (over) {
        const g = ctx.createLinearGradient(0, 0, width, height)
        g.addColorStop(0, '#b91c1c')
        g.addColorStop(1, '#ea580c')
        ctx.fillStyle = g
    } else {
        ctx.fillStyle = 'rgba(30,40,48,0.88)'
    }
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = over ? '#fff7ed' : '#e2e8f0'
    ctx.font = 'bold 56px "Bahnschrift","Noto Sans SC",sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const line = lim === '' ? `${curDisp}°C` : `${curDisp}/${lim}°C`
    ctx.fillText(line, width / 2, height / 2)
}

export function drawVerticalTankName(ctx, text) {
    const { width, height } = ctx.canvas
    const chars = Array.from(text ?? '')
    const lineHeight = Math.min(92, Math.floor((height - 24) / Math.max(chars.length, 1)))
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.max(44, lineHeight)}px "Noto Sans SC"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const totalHeight = lineHeight * chars.length
    const startY = height / 2 - totalHeight / 2 + lineHeight / 2
    chars.forEach((char, index) => {
        ctx.fillText(char, width / 2, startY + index * lineHeight)
    })
}

