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

