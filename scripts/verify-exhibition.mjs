import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'

// 通过 Chrome DevTools Protocol 验证真实 WebGPU，不引入浏览器测试依赖。
// 用法：node scripts/verify-exhibition.mjs <Chrome 路径> <已存在的临时目录>
const [chromePath, tempRoot] = process.argv.slice(2)
if (!chromePath || !tempRoot) throw new Error('需要 Chrome 可执行文件路径与已存在的临时输出目录')
const output = await mkdtemp(join(tempRoot, 'exhibition-'))
const server = await createServer({ server: { host: '127.0.0.1', port: 5183, strictPort: true } })
await server.listen()
const chrome = spawn(chromePath, [
  '--headless=new', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
  `--user-data-dir=${join(output, 'profile')}`, 'about:blank',
], { stdio: 'ignore' })
let socket
const pending = new Map()
const errors = []
let requestId = 0
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 90000)
  pending.set(id, { resolve, reject, timeout })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const screenshot = async (name) => {
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(output, `${name}.png`), Buffer.from(data, 'base64'))
}

try {
  let target
  for (let i = 0; i < 60; i++) {
    try {
      // 只连接本次独立 profile 的端口，避免重复运行时连到上一次或用户的浏览器。
      const port = (await readFile(join(output, 'profile', 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim()
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = targets.find(item => item.type === 'page')
      if (target) break
    }
    catch {}
    await delay(500)
  }
  assert.ok(target, 'Chrome CDP 未启动')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      const item = pending.get(message.id)
      if (!item) return
      clearTimeout(item.timeout)
      pending.delete(message.id)
      if (message.error) item.reject(new Error(JSON.stringify(message.error)))
      else item.resolve(message.result)
    }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args)
    else if (message.method === 'Network.loadingFailed' && !message.params.canceled) console.log('Network failure:', message.params)
  })
  socket.addEventListener('close', () => {
    for (const item of pending.values()) {
      clearTimeout(item.timeout)
      item.reject(new Error('Chrome CDP 已关闭'))
    }
    pending.clear()
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: 'http://127.0.0.1:5183/' })
  await delay(1000)
  let ready = false
  for (let i = 0; i < 120; i++) {
    ready = await evaluate(`(async () => {
      if (document.readyState !== 'complete' || location.origin !== 'http://127.0.0.1:5183') return false
      // Vite 初次依赖预构建可能重载页面；先等主入口初始化完成，再导入已加载的同一模块。
      if (!document.querySelector('.status-panel')?.hidden) return false
      const E = (await import('/js/Experience.js')).default
      if (!E.instance?.initialized) return false
      window.experience = E.instance
      return true
    })()`)
    if (ready || errors.length) break
    await delay(500)
  }
  if (!ready) {
    console.log('Startup diagnostics:', await evaluate(`({
      url: location.href, readyState: document.readyState,
      status: document.querySelector('.status-panel')?.textContent,
      gpu: !!navigator.gpu,
      requests: performance.getEntriesByType('resource').map(item => ({ url: item.name, status: item.responseStatus })),
    })`))
  }
  assert.ok(ready, `场景初始化失败：${JSON.stringify(errors)}`)
  await delay(1500)
  const report = await evaluate(`(async () => {
    const e = window.experience
    const w = e.world
    const THREE = { Box3: w.exhibition.metrics.bounds.constructor }
    const product = w.product
    const rig = product.productRig
    const assembly = rig.controllerAssembly
    w.intro.skip()
    w.cameraDirector.transitionTo('hero', { force: true, immediate: true })
    document.querySelector('.debug-panel').style.display = 'none'
    const snapshot = () => [rig.params.productAngle, ...rig.hingePivot.quaternion.toArray(), ...product.nodes.controllerAssembly.matrix.elements]
    const before = snapshot()
    const metrics = product.getExhibitionMetrics()
    const restored = JSON.stringify(before) === JSON.stringify(snapshot())
    e.scene.updateMatrixWorld(true)
    const plinthBounds = new THREE.Box3().setFromObject(w.exhibition.plinth.group, true)
    const sides = [w.exhibition.parts, w.exhibition.dock].map(group => new THREE.Box3().setFromObject(group, true))
    let foldMinimum = Infinity
    for (let angle = 8; angle <= 110; angle += 2) {
      rig.setProductAngle(angle)
      product.presentationRoot.updateMatrixWorld(true)
      for (const node of [product.nodes.bottomHalf, product.nodes.topHalf]) {
        foldMinimum = Math.min(foldMinimum, new THREE.Box3().setFromObject(node, true).min.y)
      }
    }
    rig.setProductAngle(110)
    assembly.play()
    const timeline = assembly.timeline
    timeline.pause()
    const duration = timeline.duration()
    let minimumY = Infinity
    let sideIntersections = 0
    let plinthIntersections = 0
    const sweep = new THREE.Box3()
    for (let step = 0; step <= 240; step++) {
      timeline.seek(duration * step / 240, false)
      product.presentationRoot.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(product.nodes.controllerAssembly, true)
      minimumY = Math.min(minimumY, bounds.min.y)
      sweep.union(bounds)
      if (sides.some(side => side.intersectsBox(bounds))) sideIntersections++
      if (plinthBounds.intersectsBox(bounds)) plinthIntersections++
    }
    assembly.setInstalledPose()
    const matrixError = Math.max(...product.nodes.controllerAssembly.matrix.elements.map((value, i) => Math.abs(value - rig.controllerInstalledMatrix.elements[i])))
    const initialHeight = w.exhibition.params.heightRatio
    const initialProduct = product.presentationRoot.matrixWorld.toArray()
    w.exhibition.params.heightRatio = 0.1
    w.exhibition.applyLayout()
    e.scene.updateMatrixWorld(true)
    const tallerTop = new THREE.Box3().setFromObject(w.exhibition.plinth.group, true).max.y
    const productUnmoved = JSON.stringify(initialProduct) === JSON.stringify(product.presentationRoot.matrixWorld.toArray())
    w.exhibition.params.heightRatio = initialHeight
    w.exhibition.applyLayout()
    const framing = []
    const projectBounds = (bounds) => {
      const limits = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const point = bounds.min.clone().set(x, y, z).project(e.camera.instance)
        limits.minX = Math.min(limits.minX, point.x)
        limits.maxX = Math.max(limits.maxX, point.x)
        limits.minY = Math.min(limits.minY, point.y)
        limits.maxY = Math.max(limits.maxY, point.y)
      }
      return limits
    }
    for (const shot of ['folded', 'assembly', 'hero', 'play']) {
      rig.setProductAngle(shot === 'folded' ? 8 : 110)
      product.presentationRoot.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(product.nodes.bottomHalf, true)
      bounds.union(new THREE.Box3().setFromObject(product.nodes.topHalf, true))
      if (shot !== 'folded') bounds.union(new THREE.Box3().setFromObject(product.nodes.controllerAssembly, true))
      w.cameraDirector.transitionTo(shot, { force: true, immediate: true })
      e.camera.instance.updateMatrixWorld(true)
      framing.push({ shot, ...projectBounds(bounds) })
    }
    w.cameraDirector.transitionTo('hero', { force: true, immediate: true })
    e.camera.instance.updateMatrixWorld(true)
    const heroExhibits = [plinthBounds, ...sides].map(projectBounds)
    const orbitChecks = []
    const point = metrics.center.clone()
    const spherical = w.cameraDirector.orbitSpherical.clone()
    const raycaster = new w.inputRouter.raycaster.constructor()
    for (const shot of ['hero', 'play']) {
      w.cameraDirector.transitionTo(shot, { force: true, immediate: true })
      const controls = e.camera.controls
      for (const theta of [controls.minAzimuthAngle, controls.maxAzimuthAngle]) {
        for (const phi of [controls.minPolarAngle, controls.maxPolarAngle]) {
          for (const radius of [controls.minDistance, controls.maxDistance]) {
            spherical.set(radius, phi, theta)
            e.camera.instance.position.copy(controls.target).add(point.setFromSpherical(spherical))
            e.camera.instance.lookAt(controls.target)
            e.camera.instance.updateMatrixWorld(true)
            let extent = 0
            product.presentationRoot.traverseVisible(mesh => {
              const positions = mesh.geometry?.attributes.position
              if (!positions) return
              for (let i = 0; i < positions.count; i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(e.camera.instance)
                extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y))
              }
            })
            let obscured = false
            for (const screen of [product.nodes.topScreen, product.nodes.bottomDisplay]) {
              screen.geometry.computeBoundingBox()
              screen.geometry.boundingBox.getCenter(point).applyMatrix4(screen.matrixWorld)
              const distance = e.camera.instance.position.distanceTo(point)
              raycaster.set(e.camera.instance.position, point.sub(e.camera.instance.position).normalize())
              const hit = raycaster.intersectObjects([w.exhibition.parts, w.exhibition.dock, w.exhibition.plinth.group], true)[0]
              if (hit && hit.distance < distance - 0.001) obscured = true
            }
            orbitChecks.push({ shot, extent, obscured })
          }
        }
      }
    }
    w.cameraDirector.transitionTo('hero', { force: true, immediate: true })
    return {
      restored, matrixError, productUnmoved, tallerTop, foldMinimum, framing, heroExhibits, orbitChecks,
      sidesIntersectPlinth: sides.some(side => side.intersectsBox(plinthBounds)),
      metrics: { width: metrics.width, depth: metrics.depth, supportY: metrics.supportY, center: metrics.center.toArray() },
      plinth: { min: plinthBounds.min.toArray(), max: plinthBounds.max.toArray() },
      assembly: { minimumY, sideIntersections, plinthIntersections, sweep: { min: sweep.min.toArray(), max: sweep.max.toArray() } },
    }
  })()`)
  console.log(JSON.stringify(report, null, 2))
  assert.equal(report.restored, true, '布局测量改变了产品姿态')
  assert.equal(report.productUnmoved, true, '底座厚度改变了产品世界矩阵')
  assert.ok(Math.abs(report.tallerTop - report.metrics.supportY) < 1e-5, '底座顶面高度漂移')
  assert.ok(report.matrixError < 1e-12, '装配终点矩阵偏离 GLB')
  assert.equal(report.assembly.sideIntersections, 0, '装配扫掠碰到左右展组')
  assert.equal(report.sidesIntersectPlinth, false, '展组灰盒碰到底座')
  assert.equal(report.assembly.plinthIntersections, 0, '装配扫掠碰到底座')
  assert.ok(report.foldMinimum >= report.metrics.supportY, '折叠时手机穿底座')
  for (const frame of report.framing) {
    assert.ok(frame.minX >= -1 && frame.maxX <= 1 && frame.minY >= -1 && frame.maxY <= 1, '产品保守包围盒超出机位：' + frame.shot)
  }
  for (const check of report.orbitChecks) {
    assert.ok(check.extent <= 1, 'Orbit 边界裁切产品：' + JSON.stringify(check))
    assert.equal(check.obscured, false, '展品遮挡屏幕：' + check.shot)
  }
  await screenshot('hero')
  for (const shot of ['folded', 'assembly', 'play']) {
    await evaluate(`(() => {
      const w = experience.world
      w.product.productRig.setProductAngle(${shot === 'folded' ? 8 : 110})
      w.product.productRig.controllerAssembly.setVisible(${shot !== 'folded'})
      w.cameraDirector.transitionTo('${shot}', { force: true, immediate: true })
    })()`)
    await screenshot(shot)
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false })
  await delay(300)
  const narrow = await evaluate(`(() => {
    const w = experience.world
    w.cameraDirector.transitionTo('hero', { force: true, immediate: true })
    return { parts: w.exhibition.parts.visible, dock: w.exhibition.dock.visible, fov: experience.camera.instance.fov }
  })()`)
  assert.equal(narrow.parts, false)
  assert.equal(narrow.dock, false)
  await screenshot('narrow-hero')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await delay(300)
  assert.equal(await evaluate('experience.world.exhibition.parts.visible'), true)
  assert.ok(Math.abs(await evaluate('experience.camera.instance.fov') - 31) < 1e-8, 'resize 累积了 FOV')
  await evaluate('experience.world.intro.play()')
  let introFinished = false
  for (let i = 0; i < 30; i++) {
    await delay(500)
    introFinished = await evaluate("experience.state.introState === 'ready' && !experience.world.cameraDirector.timeline")
    if (introFinished) break
  }
  assert.equal(introFinished, true, '完整 Replay 未回到 Ready')
  assert.equal(await evaluate('experience.world.exhibition.params.enabled'), true)
  await evaluate('experience.world.intro.play(); experience.world.intro.skip()')
  await delay(1600)
  const cleanup = await evaluate(`(() => {
    const w = experience.world
    const resources = new Set([w.stage.mesh.geometry, w.stage.material, ...Object.values(w.stage.textures)])
    w.exhibition.group.traverse(child => {
      if (child.geometry) resources.add(child.geometry)
      if (child.material) resources.add(child.material)
    })
    const disposed = new Set()
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.add(resource))
    experience.destroy()
    return { expected: resources.size, disposed: disposed.size, detached: w.exhibition.group.parent === null }
  })()`)
  assert.equal(cleanup.disposed, cleanup.expected)
  assert.equal(cleanup.detached, true)
  assert.equal(errors.length, 0, `浏览器错误：${JSON.stringify(errors)}`)
  console.log(`WebGPU、241 帧装配扫掠、折叠区间、高度/矩阵恢复、窄屏及销毁检查通过。截图：${output}`)
}
finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close') }
    catch {}
  }
  for (const item of pending.values()) clearTimeout(item.timeout)
  socket?.close()
  chrome.kill()
  await server.close()
}
