import { RenderPipeline } from 'three/webgpu'
import { diffuseColor, mrt, normalView, output, pass, uniform, vec4 } from 'three/tsl'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js'
import { ao } from 'three/addons/tsl/display/GTAONode.js'

export function createSsgiPipeline({ renderer, scene, camera, params }) {
  const scenePass = pass(scene, camera)
  scenePass.setMRT(mrt({ output, normal: normalView, diffuse: diffuseColor }))
  const beauty = scenePass.getTextureNode('output')
  const depth = scenePass.getTextureNode('depth')
  const normal = scenePass.getTextureNode('normal')
  const albedo = scenePass.getTextureNode('diffuse')
  const gi = ssgi(beauty, depth, normal, camera)
  // Spatial filtering avoids history leaking when switching experiment cases.
  gi.useTemporalFiltering = false
  gi.sliceCount.value = 3
  gi.stepCount.value = 8
  gi.useScreenSpaceSampling.value = false
  // r186 exposes GI and AO as separate attachments; pack them for filtering.
  const filtered = denoise(vec4(gi.getGINode().rgb, gi.getAONode().r), depth, normal, camera)
  filtered.radius.value = 3
  const indirect = filtered.rgb.mul(albedo.rgb)
  const views = {
    beauty,
    combined: vec4(beauty.rgb.mul(filtered.a).add(indirect), beauty.a),
    indirect: vec4(indirect, 1),
    ao: vec4(filtered.aaa, 1),
  }
  const gtao = ao(depth, normal, camera)
  gtao.useTemporalFiltering = false
  const gtaoFiltered = denoise(gtao.getTextureNode(), depth, normal, camera)
  gtaoFiltered.radius.value = 3
  const gtaoIntensity = uniform(1)
  const occlusion = gtaoFiltered.r.clamp(0, 1).pow(gtaoIntensity)
  const gtaoViews = Object.fromEntries(Object.entries(views).map(([key, value]) => [
    key, vec4(value.rgb.mul(occlusion), value.a),
  ]))
  const gtaoOnly = vec4(occlusion, occlusion, occlusion, 1)
  const pipeline = new RenderPipeline(renderer, views.combined)
  let currentView = 'combined'

  return {
    render(definition) {
      gi.giIntensity.value = params.ssgiIntensity
      gi.aoIntensity.value = params.ssgiAoIntensity
      gi.radius.value = params.ssgiRadius
      gi.thickness.value = params.ssgiThickness
      gtao.radius.value = params.gtaoRadius
      gtao.thickness.value = params.gtaoThickness
      gtaoIntensity.value = params.gtaoIntensity
      const view = params.ssgiEnabled ? params.ssgiView : 'beauty'
      const useGtao = definition.gtao === true && params.gtaoEnabled
      const key = `${view}:${useGtao}:${useGtao && params.gtaoShowOnly}`
      if (currentView !== key) {
        currentView = key
        pipeline.outputNode = useGtao
          ? (params.gtaoShowOnly ? gtaoOnly : gtaoViews[view] ?? gtaoViews.combined)
          : views[view] ?? views.combined
        pipeline.needsUpdate = true
      }
      pipeline.render()
    },
  }
}
