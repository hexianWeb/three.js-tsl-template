import * as THREE from 'three/webgpu'

/**
 * @param {number} opacity
 */
export function createLiquidMaterial(opacity) {
    return new THREE.MeshBasicMaterial({
        color: '#2aa8ff',
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide
    })
}

export function createFoamTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256 * 4
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (let i = 0; i < 120; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const r = 4 + Math.random() * 13
        const alpha = 0.4 + Math.random() * 0.42
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
        gradient.addColorStop(0, `rgba(255,255,255,${alpha})`)
        gradient.addColorStop(0.58, `rgba(255,255,255,${alpha * 0.55})`)
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(2, 1)
    texture.anisotropy = 4
    return texture
}

/**
 * @param {THREE.Texture} foamTexture
 */
export function createFoamMaterial(foamTexture) {
    return new THREE.MeshBasicMaterial({
        map: foamTexture,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: THREE.DoubleSide
    })
}
