import Experience from './js/Experience.js'
import './style.css'

const canvas = document.querySelector('.webgl')
const debugPanel = document.querySelector('.debug-panel')
const statusPanel = document.querySelector('.status-panel')
const statusTitle = document.querySelector('.status-title')
const statusDetail = document.querySelector('.status-detail')

let experience = null

function showStatus(title, detail = '') {
  statusTitle.textContent = title
  statusDetail.textContent = detail
  statusPanel.hidden = false
}

function hideStatus() {
  statusPanel.hidden = true
}

async function start() {
  if (!navigator.gpu) {
    canvas.hidden = true
    debugPanel.hidden = true
    showStatus('当前浏览器不支持 WebGPU', '请使用最新版 Chrome、Edge 或其他支持 WebGPU 的浏览器。')
    return
  }

  experience = new Experience({ canvas, debugPanel })
  experience.events.on('resources:progress', ({ loaded, total, name }) => {
    showStatus('正在加载产品模型', `${loaded} / ${total} · ${name}`)
  })

  try {
    showStatus('正在初始化 WebGPU')
    await experience.init()
    hideStatus()
  }
  catch (error) {
    console.error(error)
    experience.destroy()
    canvas.hidden = true
    debugPanel.hidden = true
    showStatus('场景初始化失败', error instanceof Error ? error.message : '发生未知错误。')
  }
}

start()

if (import.meta.hot) {
  import.meta.hot.dispose(() => experience?.destroy())
}
