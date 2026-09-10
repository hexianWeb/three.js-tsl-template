import * as THREE from 'three/webgpu'

const DAY_DURATION_SECONDS = 30
const ORBIT_RADIUS = 10
const DAY_COLOR = [1, 0.95, 0.82]
const SUNRISE_COLOR = [1, 0.45, 0.2]
const MOON_COLOR = [0.32, 0.42, 0.68]

function mixColor(from, to, amount) {
  return from.map((value, index) => value + (to[index] - value) * amount)
}

export function calculateDayNightState(time, directIntensity) {
  const normalizedTime = ((time % 1) + 1) % 1
  const angle = (normalizedTime - 0.25) * Math.PI * 2
  const sunHeight = Math.sin(angle)
  const daylight = Math.max(0, sunHeight)
  const isDay = sunHeight >= 0

  return {
    position: {
      x: Math.cos(angle) * ORBIT_RADIUS,
      y: Math.max(Math.abs(sunHeight) * ORBIT_RADIUS, 0.5),
      z: ORBIT_RADIUS * 0.4,
    },
    intensity: isDay
      ? directIntensity * (0.12 + daylight * 0.88)
      : directIntensity * 0.08,
    lightColor: isDay
      ? mixColor(SUNRISE_COLOR, DAY_COLOR, daylight)
      : MOON_COLOR,
  }
}

export function createDayNightCycle({ scene, light, params }) {
  const referenceColor = light.color.clone()
  const referencePosition = light.position.clone()
  let animated = false

  if (!scene.background?.isColor) {
    scene.background = new THREE.Color('#000000')
  }

  function applyReferenceLight() {
    light.color.copy(referenceColor)
    light.position.copy(referencePosition)
    light.intensity = params.directIntensity
    scene.background.set(0x000000)
  }

  function applyCurrentTime() {
    const state = calculateDayNightState(params.dayNightTime, params.directIntensity)
    const target = light.target.position
    light.position.set(
      target.x + state.position.x,
      target.y + state.position.y,
      target.z + state.position.z,
    )
    light.intensity = state.intensity
    light.color.setRGB(...state.lightColor)
    scene.background.set(0x000000)
  }

  return {
    setAnimated(value) {
      animated = value === true
    },
    update(elapsedSeconds = 0) {
      if (!animated) {
        applyReferenceLight()
        return
      }

      params.dayNightTime = ((elapsedSeconds / DAY_DURATION_SECONDS) % 1 + 1) % 1
      applyCurrentTime()
    },
    get animated() {
      return animated
    },
  }
}
