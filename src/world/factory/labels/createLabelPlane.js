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

export function drawTrack(ctx, text) {
    const { width, height } = ctx.canvas
    ctx.fillStyle = 'rgba(20,30,48,0.85)'
    roundRect(ctx, 8, height / 2 - 36, width - 16, 72, 16)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text ?? '', width / 2, height / 2)
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}
