import '../../nds-player.css'

export default class NDSControls {
  constructor({ onPlay, onBack, onFile, onAudio }) {
    this.listeners = new AbortController()
    this.element = document.createElement('section')
    this.element.className = 'nds-player'
    this.element.hidden = true
    this.element.setAttribute('aria-label', 'NDS 游戏控制')
    this.element.innerHTML = `
      <div class="nds-player__heading"><span>NDS / LIVE PLAY</span><span data-field="mode">GAME HOME</span></div>
      <p class="nds-player__status" data-field="status" role="status" aria-live="polite"></p>
      <div class="nds-player__actions">
        <button type="button" data-action="play">Continue</button>
        <button type="button" data-action="audio">启用声音</button>
        <button type="button" data-action="cancel" hidden>取消启动</button>
      </div>
      <label class="nds-player__file">选择 .nds 文件<input type="file" accept=".nds,.srl" aria-label="选择 NDS 游戏文件"></label>
      <p class="nds-player__audio" data-field="audio"></p>
      <output class="nds-player__metrics" data-field="metrics">等待游戏开始</output>
      <details>
        <summary>操作说明</summary>
        <p>方向键移动 · X/Z = A/B · S/A = X/Y · Q/W = L/R · Enter = Start · Shift = Select。点击或拖动 3D 下屏进行触控。</p>
        <p>标准手柄：右/下/上/左面键 = A/B/X/Y，肩键 = L/R，菜单键 = Start/Select。Home 下底部面键可 Continue。</p>
        <p>Escape 返回并暂停；切换窗口自动返回。再次 Continue 接续当前会话，刷新页面不保留存档。</p>
      </details>`
    this.fields = Object.fromEntries([...this.element.querySelectorAll('[data-field]')].map(node => [node.dataset.field, node]))
    this.buttons = Object.fromEntries([...this.element.querySelectorAll('[data-action]')].map(node => [node.dataset.action, node]))
    this.fileInput = this.element.querySelector('input')
    const options = { signal: this.listeners.signal }
    this.buttons.play.addEventListener('click', () => this.playing ? onBack() : onPlay(), options)
    this.buttons.cancel.addEventListener('click', onBack, options)
    this.buttons.audio.addEventListener('click', onAudio, options)
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files[0]
      this.fileInput.value = ''
      if (file)
        onFile(file)
    }, options)
    document.body.append(this.element)
  }

  chooseFile() {
    this.fileInput.click()
  }

  render({ mode, status, message, loading, loaded, audioEnabled, audioBusy, audioMessage }) {
    this.playing = mode === 'playing'
    this.element.hidden = mode !== 'game-home' && !this.playing
    this.element.dataset.state = status
    this.fields.mode.textContent = this.playing ? 'PLAYING' : 'GAME HOME'
    this.fields.status.textContent = message
    this.buttons.play.textContent = this.playing ? '暂停 / 返回' : loading ? '正在载入…' : loaded ? 'Continue · 继续游戏' : 'Continue · 开始游戏'
    this.buttons.play.disabled = loading
    this.buttons.cancel.hidden = !loading
    this.buttons.audio.disabled = audioBusy
    this.buttons.audio.textContent = audioBusy ? '正在启用…' : audioEnabled ? '静音' : '启用声音'
    this.fields.audio.textContent = audioMessage
    this.fileInput.disabled = loading || this.playing
    if (!this.playing)
      this.fields.metrics.textContent = loaded ? '会话已暂停 · Continue 恢复' : '按需载入 WASM · 本地 ROM'
  }

  setStats({ fps, speed, frameMs, sceneFps }) {
    this.fields.metrics.textContent = `NDS ${fps.toFixed(1)} fps · ${speed.toFixed(0)}% · 核心 ${frameMs.toFixed(1)} ms · 场景 ${sceneFps.toFixed(1)} fps`
  }

  destroy() {
    this.listeners.abort()
    this.element.remove()
  }
}
