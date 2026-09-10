export function getTechnologyTitle(definition, params) {
  const technologies = {
    A: 'Full Bake', B: 'Indirect Lightmap + Direct Light',
    C: 'Indirect Lightmap', D: 'PBR + Direct Light',
    E: 'Light Probe Grid', F: 'Light Probe Grid', G: 'Light Probe Grid',
  }
  let title = technologies[definition.id]
  if (definition.ssgi && params.ssgiEnabled) title += ' + SSGI'
  if (definition.gtao && params.gtaoEnabled) title += ' + GTAO'
  if (definition.gtao && params.gtaoEnabled && params.gtaoShowOnly) title += ' · GTAO Only'
  else if (definition.ssgi && params.ssgiEnabled && params.ssgiView !== 'combined') {
    title += params.ssgiView === 'ao' ? ' · AO View' : ' · Indirect View'
  }
  return title
}

export function createTechnologyTitle() {
  const element = document.createElement('h2')
  element.className = 'technology-title'
  const badge = document.createElement('span')
  const title = document.createElement('strong')
  element.append(badge, title)
  document.body.appendChild(element)
  return {
    update(definition, params) {
      const text = getTechnologyTitle(definition, params)
      if (title.textContent !== text) title.textContent = text
      if (badge.textContent !== `CASE ${definition.id}`) badge.textContent = `CASE ${definition.id}`
    },
  }
}
