import { RenderPipeline } from 'three/webgpu'
import { diffuseColor, mrt, normalView, output, pass, vec4 } from 'three/tsl'
import { ssgi } from 'three/addons/tsl/display/SSGINode.js'
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js'

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
    combined: vec4(beauty.rgb.mul(filtered.a).add(indirect), beauty.a),
    indirect: vec4(indirect, 1),
    ao: vec4(filtered.aaa, 1),
  }
  const pipeline = new RenderPipeline(renderer, views.combined)
  let currentView = 'combined'

  return {
    render() {
      gi.giIntensity.value = params.ssgiIntensity
      gi.aoIntensity.value = params.ssgiAoIntensity
      gi.radius.value = params.ssgiRadius
      gi.thickness.value = params.ssgiThickness
      if (currentView !== params.ssgiView) {
        currentView = params.ssgiView
        pipeline.outputNode = views[currentView] ?? views.combined
        pipeline.needsUpdate = true
      }
      pipeline.render()
    },
  }
}
