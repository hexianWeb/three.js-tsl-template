import { Pane } from 'tweakpane'
import { getCaseOptions } from '../experiment/caseDefinitions.js'

export function setupGui({
  params,
  onCaseChange,
  onEmissionUvChange,
  onRebakeProbes,
}) {
  const pane = new Pane({ title: 'GI Ablation Study' })

  pane
    .addBinding(params, 'caseId', {
      label: 'Case',
      options: getCaseOptions(),
    })
    .on('change', (event) => onCaseChange(event.value))

  const presentation = pane.addFolder({ title: 'Shared Presentation (A-F)', expanded: false })
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

  const caseLighting = pane.addFolder({ title: 'Case-controlled Lighting', expanded: false })
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

  const ssgi = pane.addFolder({ title: 'SSGI (Case F)' })
  ssgi.addBinding(params, 'ssgiEnabled', { label: 'Enable SSGI' })
  ssgi.addBinding(params, 'ssgiView', { label: 'View', options: {
    Combined: 'combined', 'SSGI Indirect': 'indirect', Occlusion: 'ao',
  } })
  ssgi.addBinding(params, 'ssgiIntensity', { label: 'Bounce Intensity', min: 0, max: 10, step: 0.05 })
  ssgi.addBinding(params, 'ssgiAoIntensity', { label: 'AO Intensity', min: 0, max: 4, step: 0.05 })
  ssgi.addBinding(params, 'ssgiRadius', { label: 'Radius', min: 0.1, max: 10, step: 0.1 })
  ssgi.addBinding(params, 'ssgiThickness', { label: 'Thickness', min: 0.01, max: 2, step: 0.01 })

  const probes = pane.addFolder({ title: 'Light Probe Grid (E / F)' })
  probes.addBinding(params, 'probeIntensity', {
    label: 'GI Intensity',
    min: 0,
    max: 3,
    step: 0.01,
  })
  probes.addBinding(params, 'probeBounces', {
    label: 'Bounces (Rebake)',
    min: 0,
    max: 3,
    step: 1,
  })
  probes.addBinding(params, 'showProbeHelper', { label: 'Show Probes' })
  probes
    .addButton({ title: 'Rebake Probes' })
    .on('click', onRebakeProbes)

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
