import { CASE_DEFINITIONS } from '../experiment/caseDefinitions.js'
import { CHANNEL, isCameraState, isCaseId } from './protocol.js'

export function createComparisonView() {
  document.querySelector('canvas.webgl').remove()
  document.body.classList.add('comparison-page')
  document.body.innerHTML = `
    <main class="comparison">
      <header class="comparison-toolbar">
        <div><h1>GI 消融对照</h1><p>同一视角 · 独立渲染 · E / F 默认对照</p></div>
        <div class="comparison-actions">
          <label><input id="sync-camera" type="checkbox" checked>同步相机</label>
          <label><input id="sync-params" type="checkbox" checked>同步参数</label>
          <label><input id="show-controls" type="checkbox">参数面板</label>
          <button id="swap-cases" type="button">交换左右</button>
          <a href="?view=single">单视图</a>
        </div>
      </header>
      <div class="comparison-views">
        <section class="comparison-side" aria-label="左侧实验">
          <header><label for="left-case">左侧 / 基准</label><select id="left-case"></select><span id="left-status" role="status">加载与探针烘焙中…</span></header>
          <iframe id="left-frame" title="左侧 GI 场景"></iframe>
        </section>
        <section class="comparison-side" aria-label="右侧实验">
          <header><label for="right-case">右侧 / 对照</label><select id="right-case"></select><span id="right-status" role="status">加载与探针烘焙中…</span></header>
          <iframe id="right-frame" title="右侧 GI 场景"></iframe>
        </section>
      </div>
      <footer>拖动任一侧旋转，滚轮缩放。参数同步不包含 Case、探针重烘焙及 UV 调试操作；两侧动画独立计时。双视图会增加 GPU 开销。</footer>
    </main>`

  const syncCamera = document.querySelector('#sync-camera')
  const syncParams = document.querySelector('#sync-params')
  const showControls = document.querySelector('#show-controls')
  const sides = ['left', 'right'].map((name, index) => {
    const select = document.querySelector(`#${name}-case`)
    for (const { id, label } of Object.values(CASE_DEFINITIONS)) select.add(new Option(label, id))
    select.value = index === 0 ? 'E' : 'F'
    return { select, frame: document.querySelector(`#${name}-frame`), status: document.querySelector(`#${name}-status`), ready: false }
  })
  let owner = sides[0]
  let lastCamera = null
  let lastParams = null
  const send = (side, type, payload) => {
    if (side.ready) side.frame.contentWindow.postMessage({ channel: CHANNEL, type, payload }, window.location.origin)
  }
  const setCase = (side) => send(side, 'case', side.select.value)

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.channel !== CHANNEL) return
    const side = sides.find((entry) => entry.frame.contentWindow === event.source)
    if (!side) return
    const other = sides.find((entry) => entry !== side)
    const { type, payload } = event.data
    if (type === 'ready') {
      side.ready = true
      side.status.textContent = '就绪'
      setCase(side)
      send(side, 'controls', showControls.checked)
      lastCamera ??= payload.camera
      lastParams ??= payload.params
      if (syncCamera.checked) send(side, 'camera', lastCamera)
      if (syncParams.checked) send(side, 'params', lastParams)
    } else if (type === 'error') {
      side.status.textContent = '加载失败，请查看场景错误提示'
    } else if (type === 'camera-owner') {
      owner = side
    } else if (type === 'case-state' && isCaseId(payload)) {
      side.select.value = payload
    } else if (type === 'camera' && side === owner && isCameraState(payload)) {
      lastCamera = payload
      if (syncCamera.checked) send(other, 'camera', payload)
    } else if (type === 'params') {
      lastParams = payload
      if (syncParams.checked) send(other, 'params', payload)
    }
  })
  for (const side of sides) {
    side.select.addEventListener('change', () => setCase(side))
    side.frame.src = `?view=single&embed=1&case=${side.select.value}`
  }
  document.querySelector('#swap-cases').addEventListener('click', () => {
    const previous = sides[0].select.value
    sides[0].select.value = sides[1].select.value
    sides[1].select.value = previous
    sides.forEach(setCase)
  })
  showControls.addEventListener('change', () => sides.forEach((side) => send(side, 'controls', showControls.checked)))
  syncCamera.addEventListener('change', () => {
    if (syncCamera.checked) send(owner, 'snapshot')
  })
  syncParams.addEventListener('change', () => {
    if (syncParams.checked && lastParams) sides.forEach((side) => send(side, 'params', lastParams))
  })
}
