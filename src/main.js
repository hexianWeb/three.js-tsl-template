import { createExperimentApp } from './app/createExperimentApp.js'

function showStartupError(error) {
  console.error(error)
  window.__portal = { error: error?.stack || String(error) }

  const element = document.createElement('pre')
  element.textContent = error?.stack || String(error)
  element.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20;color:#ff8b8b;background:#000c;padding:12px;max-width:80vw;white-space:pre-wrap;font:12px/1.4 monospace;'
  document.body.appendChild(element)
}

createExperimentApp().catch(showStartupError)
