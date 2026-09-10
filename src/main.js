import { CASE_DEFINITIONS } from './experiment/caseDefinitions.js'
import { CHANNEL, CLOCK_QUERY, parseClockEpoch } from './comparison/protocol.js'

function showStartupError(error) {
  console.error(error)
  window.__portal = { error: error?.stack || String(error) }

  const element = document.createElement('pre')
  element.textContent = error?.stack || String(error)
  element.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20;color:#ff8b8b;background:#000c;padding:12px;max-width:80vw;white-space:pre-wrap;font:12px/1.4 monospace;'
  document.body.appendChild(element)
  if (window.parent !== window) {
    window.parent.postMessage({ channel: CHANNEL, type: 'error' }, window.location.origin)
  }
}

async function start() {
  const query = new URLSearchParams(window.location.search)
  if (query.get('view') === 'single') {
    const { createExperimentApp } = await import('./app/createExperimentApp.js')
    const embedded = query.get('embed') === '1' && window.parent !== window
    const caseId = Object.hasOwn(CASE_DEFINITIONS, query.get('case')) ? query.get('case') : 'F'
    const app = await createExperimentApp({
      caseId,
      embedded,
      clockEpoch: parseClockEpoch(query.get(CLOCK_QUERY)) ?? undefined,
    })
    if (embedded) {
      const { connectEmbeddedExperiment } = await import('./comparison/connectEmbeddedExperiment.js')
      connectEmbeddedExperiment(app)
    } else {
      const link = document.createElement('a')
      link.href = window.location.pathname
      link.textContent = '← 双视图对照'
      link.className = 'comparison-link'
      document.body.appendChild(link)
    }
  } else {
    const { createComparisonView } = await import('./comparison/createComparisonView.js')
    createComparisonView()
  }
}

start().catch(showStartupError)
