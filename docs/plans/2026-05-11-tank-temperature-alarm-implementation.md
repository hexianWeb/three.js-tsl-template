# 电镀槽温度告警 — 实现顺序

日期：2026-05-11

1. **状态与 mock** — `FactoryState.js`：为每个 tank 增加 `temperatureC`、`temperatureLimitC`；按验证需求写入 5 个代表性槽，其余默认值。
2. **槽体材质** — `createTankMaterial.js`：`aTempAlarm` 与基础色 `mix` 告警色。
3. **标签绘制** — `createLabelPlane.js`：`drawTankTemperature`。
4. **TankField** — 初始化 `aTempAlarm`、液面引用、两侧温度标签；`update(dt)` 呼吸、液面克隆切换、标签 `setText`。
5. **配置常量** — `config.js`：告警色、呼吸角速度（可选）。
6. **验证** — `npm run build`；手测清单见设计文档。
