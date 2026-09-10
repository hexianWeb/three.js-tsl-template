import * as THREE from 'three/webgpu'
import { color, select, uv, vec3 } from 'three/tsl'

const PREVIEW_SIZE = 180

export function createEmissionUvMaterial() {
  const material = new THREE.MeshBasicNodeMaterial()
  material.name = 'emission-uv-debug'

  const coordinates = uv()
  const cell = coordinates.mul(10).fract()
  const gridLine = cell.x.lessThan(0.08).or(cell.y.lessThan(0.08))
  material.colorNode = select(
    gridLine,
    color(0xffffff),
    vec3(coordinates.x, coordinates.y, 0.2),
  )
  return material
}

function drawGrid(context) {
  context.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  context.lineWidth = 1
  for (let step = 0; step <= 10; step += 1) {
    const position = step * PREVIEW_SIZE / 10
    context.beginPath()
    context.moveTo(position, 0)
    context.lineTo(position, PREVIEW_SIZE)
    context.moveTo(0, position)
    context.lineTo(PREVIEW_SIZE, position)
    context.stroke()
  }
}

function drawUvTriangles(context, geometry) {
  const uvAttribute = geometry.getAttribute('uv')
  if (!uvAttribute) {
    context.fillStyle = '#ff7676'
    context.fillText('No UV', 12, 24)
    return
  }

  const indexAttribute = geometry.index
  const indexCount = indexAttribute ? indexAttribute.count : uvAttribute.count
  context.fillStyle = 'rgba(0, 220, 255, 0.12)'
  context.strokeStyle = '#55e7ff'
  context.lineWidth = 1.25

  for (let index = 0; index < indexCount; index += 3) {
    context.beginPath()
    for (let corner = 0; corner < 3; corner += 1) {
      const uvIndex = indexAttribute ? indexAttribute.getX(index + corner) : index + corner
      const x = uvAttribute.getX(uvIndex) * PREVIEW_SIZE
      const y = (1 - uvAttribute.getY(uvIndex)) * PREVIEW_SIZE
      if (corner === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.closePath()
    context.fill()
    context.stroke()
  }
}

function displayName(name) {
  if (name === 'Cube011') return 'Cube.011'
  if (name === 'Cube014') return 'Cube.014'
  return name
}

export function createEmissionUvOverlay() {
  if (typeof document === 'undefined') {
    return { addMesh() {}, setActiveVariant() {}, setVisible() {} }
  }

  const overlay = document.createElement('section')
  overlay.setAttribute('aria-label', 'Emission UV preview')
  overlay.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:10;display:none;gap:10px;padding:10px;background:#05070de6;border:1px solid #55e7ff66;border-radius:6px;color:#fff;font:12px/1.2 monospace;pointer-events:none;'
  document.body.appendChild(overlay)

  const addedMeshes = new Set()
  const cards = []
  let activeVariant = 'baked'

  function syncCards() {
    for (const { card, variantId } of cards) {
      card.style.display = variantId === activeVariant ? 'block' : 'none'
    }
  }

  return {
    addMesh(mesh, variantId) {
      if (addedMeshes.has(mesh)) return
      addedMeshes.add(mesh)

      const card = document.createElement('div')
      const label = document.createElement('div')
      label.textContent = displayName(mesh.name)
      label.style.cssText = 'margin-bottom:6px;color:#9cf3ff;text-align:center;'

      const canvas = document.createElement('canvas')
      canvas.width = PREVIEW_SIZE
      canvas.height = PREVIEW_SIZE
      canvas.style.cssText = 'display:block;width:180px;height:180px;background:#10141c;'
      const context = canvas.getContext('2d')
      drawGrid(context)
      drawUvTriangles(context, mesh.geometry)

      card.append(label, canvas)
      overlay.appendChild(card)
      cards.push({ card, variantId })
      syncCards()
    },
    setActiveVariant(variantId) {
      activeVariant = variantId
      syncCards()
    },
    setVisible(visible) {
      overlay.style.display = visible ? 'flex' : 'none'
    },
  }
}
