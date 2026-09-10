import { Pane } from 'tweakpane'
import { getCaseOptions } from '../experiment/caseDefinitions.js'

export function setupGui({ params, onCaseChange, onEmissionUvChange }) {
  const pane = new Pane({ title: 'GI Ablation Study' })

  pane
    .addBinding(params, 'caseId', {
      label: 'Case',
      options: getCaseOptions(),
    })
    .on('change', (event) => onCaseChange(event.value))

  const presentation = pane.addFolder({ title: 'Shared Presentation (A-D)' })
  presentation.addBinding(params, 'toneMapping', {
    label: 'Tone Mapping',
    options: {
      AgX: 'agx',
      Filmic: 'filmic',
    },
  })
  presentation.addBinding(params, 'exposure', {
    label: 'Exposure',
    min: 0.1,
    max: 3,
    step: 0.01,
  })

  const emissionUv = presentation.addFolder({ title: 'Emission UV Debug' })
  emissionUv
    .addButton({ title: 'Show UV (3D + 2D)' })
    .on('click', () => onEmissionUvChange(true))
  emissionUv
    .addButton({ title: 'Show Emission' })
    .on('click', () => onEmissionUvChange(false))

  const portal = presentation.addFolder({ title: 'Portal' })
  portal.addBinding(params, 'portalColor', { label: 'Color' })
  portal.addBinding(params, 'portalIntensity', {
    label: 'Intensity',
    min: 0.1,
    max: 4,
    step: 0.01,
  })
  portal.addBinding(params, 'portalSpeed', {
    label: 'Flow Speed',
    min: 0.05,
    max: 1,
    step: 0.01,
  })

  const lanterns = presentation.addFolder({ title: 'Lanterns' })
  lanterns.addBinding(params, 'poleColor', { label: 'Color' })
  lanterns.addBinding(params, 'poleIntensity', {
    label: 'Intensity',
    min: 0.1,
    max: 3,
    step: 0.01,
  })
  lanterns.addBinding(params, 'poleFlameHeight', {
    label: 'Flame Height',
    min: 0.5,
    max: 1.6,
    step: 0.01,
  })
  lanterns.addBinding(params, 'poleFlameWidth', {
    label: 'Flame Width',
    min: 0.5,
    max: 1.6,
    step: 0.01,
  })
  lanterns.addBinding(params, 'poleFlameCore', {
    label: 'Core Size',
    min: 0.3,
    max: 0.8,
    step: 0.01,
  })

  const caseLighting = pane.addFolder({ title: 'Case-controlled Lighting' })
  caseLighting.addBinding(params, 'lightMapIntensity', {
    label: 'Lightmap',
    min: 0,
    max: 4,
    step: 0.01,
  })
  caseLighting.addBinding(params, 'directIntensity', {
    label: 'Direct Light',
    min: 0,
    max: 8,
    step: 0.01,
  })

  const dynamicDemo = pane.addFolder({ title: 'Sun Animation (Non-evaluation)' })
  dynamicDemo.addBinding(params, 'animateSun', { label: 'Animate Sun' })
  dynamicDemo.addBinding(params, 'dayNightTime', {
    label: 'Time',
    min: 0,
    max: 1,
    step: 0.001,
  })

  return pane
}
