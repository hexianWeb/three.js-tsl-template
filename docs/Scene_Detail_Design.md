# 概念产品展台设计

> 工程落地方案见 [场景细节实施方案](Scene_Detail_Implementation_Plan.md)，依据当前源码明确布局、资产边界、模块与分阶段验收。本文件保留视觉概念与候选元素；下文示意参数不代表当前运行时值。


可以围绕现在这个机位增加 6 类东西，但真正重要的是前 4 个：

| 元素                   | 建议位置   | 作用                  | 推荐度 |
| ---------------------- | ---------- | --------------------- | ------ |
| 悬浮/低矮产品展台      | Duo 正下方 | 建立视觉中心          | ★★★★★  |
| 柔和环形灯 / 地面 Halo | 主机周围   | 强化主体轮廓          | ★★★★★  |
| 3D 打印配件展示        | 左右后方   | 解释“3D 打印插件”概念 | ★★★★★  |
| 极简信息牌             | 主机左右   | Apple 展厅感          | ★★★★☆  |
| 少量游戏载体/卡带      | 前景边缘   | NDS 语义              | ★★★☆☆  |
| 空间背景墙 / 灯带      | 远处       | 消除无边界感          | ★★★★☆  |

## ① 给 Duo 增加一个真正的“产品展台”

现在主机直接放在无限网格上，导致它更像 Blender / Three.js Debug Scene。

可以在它下面加入一个：

**圆角矩形 / 椭圆形低矮底座**

比如：

```
        iPhone Duo

      ┌───────────┐
      │           │
      │   DUO     │
      │           │
      └───────────┘

    ───── Platform ─────
```

尺寸不用大：

```
宽：设备宽度 × 1.5
深：设备深度 × 1.4
高：0.04 ~ 0.08m
圆角：很大
```

材质可以是：

```
暖白 / 浅灰
roughness 0.25~0.4
metalness 0~0.1
```

然后让 Controller 稍微超出底座边缘一点。

这样会立刻从：

> 「Three.js 里放了一个模型」

变成：

> 「一个完整的产品展示场景」

甚至可以在底座侧面只放：

**iPhone Duo**

下面小字：

**Game Changer**

不要再增加大量 Logo。

## ② 地面不要完全删除，但把现在的 Grid 弱化

现在网格线的信息量其实很高，而且它们都在向远处延伸，非常抢视线。

我建议保留这种“Design Prototype”语言，但改成：

```
大面积暖灰地面
+
极淡网格
+
设备周围局部 Halo
```

比如现在：

```
gridOpacity = 0.45
```

可以降成类似：

```
0.08 ~ 0.15
```

然后在主机下面增加一层非常大的柔和 radial gradient：

```
中心：#FFFFFF
中间：#EDF3F6
外围：transparent
```

如果用 Three.js，可以直接做一个平面 TSL Shader：

```
distance(position.xz, deviceCenter)
        ↓
smoothstep()
        ↓
mix(floorColor, highlightColor)
```

视觉会非常接近产品摄影中的 **cyclorama lighting**。

## ③ 3D 打印插件本身可以成为场景装饰

那么完全可以把“产品设计过程”展示出来。

例如设备左后方摆：

```
Controller Shell
D-Pad
ABXY Button Set
Rail Adapter
```

不要像零件堆一样放。

而是类似 Apple 拆解图：

```
            Rail
              │

 D-Pad     Controller Shell     ABXY

              │
          Bottom Plate
```

每一个零件稍微悬浮：

```
Y + 0.03
```

下面有很淡的 shadow。

甚至可以放一个半透明：

```
3D PRINTED
PA12 / TPU
Prototype 03
```

的小铭牌。

这样整个场景就开始讲故事了。

# ④ 右侧增加一个「配件 Dock」

左边展示拆解件，右边可以做一个极简 Dock：

```
┌────────────┐
│ Controller │
│     ○      │
│    Dock    │
└────────────┘
```

上面放一个备用 Controller，或者不同颜色的 Controller：

```
Blue
Orange
Graphite
```

注意不要放三个完整设备。

更像：

> Material / Color Sample

例如三个很小的材质块：

```
● Sky Blue
● Graphite
● Warm White
```

这与你前面正在研究 Controller 材质也能连接起来。

# ⑤ 可以放 NDS 元素，但一定要“克制”

这个场景最容易犯的错误就是：

> 宝可梦卡带、马里奥卡带、赛车卡带、NDS 主机、Switch……

全堆上去。

这样马上会从：

**Apple Concept Product**

变成：

**Nintendo Collector Desk**

我建议 NDS 元素只留一个。

例如设备左前方：

```
┌────────┐
│ GAME   │
│ CARD   │
└────────┘
```

做一个虚构 Cartridge。

卡带上可以写：

```
DUO
01

GAME CARD
```

然后设计成一种：

> “如果 Apple 做 NDS Game Card 会怎么样”

的感觉。

这样既不会有 IP 问题，又会让整个世界观完整很多。

------

# ⑥ 后方增加非常弱的空间结构

你现在最大的问题其实是：

**远处什么都没有。**

因此地面延伸到无限远。

可以增加一堵离设备非常远的背景墙：

```
┌────────────────────────────┐


             DUO


──────────────────────────────
```

但不是传统房间墙。

建议做：

```
巨大暖白 curved wall
```

类似摄影棚 infinity wall。

甚至：

```
Floor
     ╲
      ╲
       Curved Wall
```

地面与墙之间没有硬直角。

Three.js 里直接做一个：

```
Plane
+
quarter cylinder
+
Plane
```

即可。

------

# ⑦ 背景墙上只保留一个主视觉文字

例如远处：

```
DUO
Play differently.
```

或者：

```
DUO
One device.
Two ways to play.
```

或者我觉得更适合你项目的：

```
DUO
Designed to transform.
```

文字用非常浅的灰色。

不要做霓虹 Logo。

------

# ⑧ 可以加入一个很漂亮的「磁吸轨迹」

这个元素非常适合你的结构。

因为 Controller 是滑轨接入 Duo 的。

你可以在设备两侧 / Controller 后方显示：

```
· · · · · · · →
```

或者一条非常细的轨迹：

```
───────────────
        ↓
      LOCK
```

平时几乎不可见。

当 Controller 入场动画时：

```
Rail Guide
↓
Controller slide
↓
SNAP
↓
guide fadeOut
```

这比单纯摆装饰更高级，因为它同时承担：

**空间装饰 + 产品说明 + 动画引导**

三个功能。

# ⑨ 添加局部标注 HUD，而不是传统游戏 HUD

可以在空间里增加三四个极小的 annotation：

```
01
Dual Display

02
Slide-in Controller

03
3D Printed Shell

04
WebGPU
```

例如：

```
                    01
                     │
                     │
             ┌─────────────┐
             │ iPhone Duo  │
             └─────────────┘

      02 ─── Controller
```

线条：

```
1 px
#7B8085
opacity 0.4
```

字体：

```
SF Pro / Inter
10~12 px
```

不要做科幻 HUD。

它应该更像：

> Apple 产品设计图 / Industrial Design Presentation

------

# ⑩ 在前景增加少量景深物体

你当前构图中还有一个问题：

**前景几乎为空。**

所以镜头缺少 depth cue。

可以在画面最左下、右下放一点只露出一部分的东西：

```
左下：
Game Card

右下：
Controller Shell / Material Sample
```

然后：

```
DOF blur
```

非常轻微。

最终视觉结构就会变成：

```
┌────────────────────────────────────┐
│                                    │
│          Background Wall           │
│       DUO / Designed to transform   │
│                                    │
│                                    │
│              iPhone Duo            │
│                                    │
│  Parts       Controller      Dock   │
│                                    │
│             Platform               │
│                                    │
│ card                         sample │
│      ← foreground blur →            │
└────────────────────────────────────┘
```

空间一下就会丰富很多。

------

# 我会优先做的最终方案

如果是这个项目，我不会一次加入十几种东西，而是控制为：

**第一层——主体**

```
iPhone Duo
+
3D Printed Controller
```

**第二层——产品展示**

```
Rounded Platform
+
Floor Halo
+
Soft Shadow
```

**第三层——设计语言**

```
左：Exploded Parts
右：Material / Controller Dock
```

**第四层——NDS 暗示**

```
1 张原创 Game Card
```

**第五层——环境**

```
Curved White Wall
+
极淡 Grid
+
DUO Typography
```

整体大概是：

```
                 DUO
        Designed to transform.


   Exploded                     Material
     Parts                       Samples
       ↓                            ↓

               iPhone
                Duo

          ╭─────────────╮
          │ Controller  │
          ╰─────────────╯

        ╭────────────────╮
        │    Platform    │
        ╰────────────────╯


 Game Card                         Shell
```

我认为这会比“在空地上加入很多游戏相关道具”更适合你现在已经形成的 **Apple × NDS** 视觉方向。

其中最值得优先实现的三个改动是：**低矮展台 + 弱化 Grid/增加 Halo + 左右两组工业设计配件展示**。这三项完成之后，即使不再添加其他物体，当前场景的完整度也会明显上一个层级。
