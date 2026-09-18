# iPhone Duo · WebGPU

基于 Three.js WebGPU 的 iPhone Duo 双屏掌机交互原型。

当前阶段已经建立 `Experience` 单例与 Class 组件架构，并通过统一资源系统加载 `public/iphone.glb`。模型节点、基础变换和线框模式可在 Tweakpane 中检查。

无需构建处理的公共资源请放在 `public/` 目录中。

## 开发

``` bash
npm install
npm run dev
npm run build
```

请使用支持 WebGPU 的最新版浏览器访问开发地址。
