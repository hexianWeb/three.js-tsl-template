import { Pane } from 'tweakpane'

export function setupGui({ params, onCaseChange }) {
  const pane = new Pane({ title: 'Portal Bake' })

  pane
    .addBinding(params, 'caseName', {
      label: 'Case',
      options: {
        'A Full Bake': 'A',
        'B Lightmap + Direct': 'B',
        'C Lightmap only': 'C',
      },
    })
    .on('change', (event) => {
      onCaseChange(event.value)
    })

  pane.addBinding(params, 'toneMapping', {
    label: 'Tone Mapping',
    options: {
      AgX: 'agx',
      Filmic: 'filmic',
    },
  })

  pane.addBinding(params, 'exposure', {
    label: 'Exposure',
    min: 0.1,
    max: 3,
    step: 0.01,
  })

  pane.addBinding(params, 'lightMapIntensity', {
    label: 'Lightmap Intensity',
    min: 0,
    max: 4,
    step: 0.01,
  })

  pane.addBinding(params, 'directIntensity', {
    label: 'Direct Light',
    min: 0,
    max: 8,
    step: 0.01,
  })

  const portal = pane.addFolder({ title: 'Portal Light' })
  portal.addBinding(params, 'portalColor', { label: 'Color' })
  portal.addBinding(params, 'portalIntensity', {
    label: 'Intensity',
    min: 0.1,
    max: 3,
    step: 0.01,
  })

  const poles = pane.addFolder({ title: 'Pole Lights' })
  poles.addBinding(params, 'poleColor', { label: 'Color' })
  poles.addBinding(params, 'poleIntensity', {
    label: 'Intensity',
    min: 0.1,
    max: 3,
    step: 0.01,
  })

  return pane
}
