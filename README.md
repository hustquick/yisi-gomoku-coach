# 弈思五子棋教练

## 最新版本下载

无需自行编译，前往 [最新发布页](https://github.com/hustquick/yisi-gomoku-coach/releases/latest) 下载：

- [Android 安装包](https://github.com/hustquick/yisi-gomoku-coach/releases/latest/download/yisi-gomoku-android-arm64.apk)：Android 8.0 及以上、ARM64，已签名的 Debug 侧载版，内置离线引擎与模型。
- [离线 HTML 完整包](https://github.com/hustquick/yisi-gomoku-coach/releases/latest/download/yisi-gomoku-windows-html.zip)：完整解压后，用 Edge 或 Chrome 打开 `windowsHTML/index.html`，无需服务器或联网。
- 发布页同时提供 `SHA256SUMS.txt`、包含 Rapfi 源码和模型的对应源码包，以及构建说明。

安装 APK 时需允许下载所用应用“安装未知应用”。HTML 请勿只复制 `index.html`，也不要在压缩包预览中直接打开。更新前建议先导出重要棋谱。

## 界面设计原则：任务情境决定显著性

> 在任一任务阶段，功能的可见性、位置和视觉显著程度，应当与该功能在当前任务情境下的普遍需要程度相匹配；当前阶段普遍需要的功能进入前景，已经完成使命或暂时无关的功能退出前景，但仍保持必要的可恢复性。

本项目据此采用“棋盘优先”的信息层级：竖向或窄屏时棋盘优先、极简工具在上、折叠面板在下；横向或宽屏时棋盘与极简工具在左、折叠面板在右。极简工具统一为 `↶`、`↷`、`优`、`⇅`、`↻`；双人对弈、人机对战、摆盘工具、规则和分析参数统一收进“对弈与分析设置”折叠模块，摆盘不会在棋盘附近新增面板；棋谱与存档如平台提供则排在辅助模块末端且默认折叠。折叠不会清除当前局面或配置，用户可随时恢复这些功能。

面向 HTML、iOS 和 Android 的五子棋 / 连珠思考教练。三端共享同一套棋盘语义、Rapfi 分析结果和教练评价规则，最终均支持离线分析。

## 目标功能

- 15×15 棋盘，支持五子棋与连珠规则切换。
- Rapfi 全局候选、单点候选、局面评分、主变化动画和局势图。
- 双人对弈、人机对战、摆盘、悔棋、历史局面滑移。
- 分析深度或思考时间可选，计算期间仍允许落子并自动取消旧任务。
- HTML 使用 WebAssembly 或本地桥接服务；iOS 与 Android 使用本地 ARM64 C++ 引擎。
- 引擎、配置与网络权重随应用离线提供，并完整保留 GPL-3.0 许可和对应源码信息。

## 目录

```text
五子棋/
├── html/                 HTML / PWA 客户端
├── ios/                  SwiftUI 客户端与 Rapfi C++ 桥接
├── android/              Android 客户端与 JNI 桥接
├── shared/               三端共享的协议、数据模型和教练规则
├── engine/               Rapfi 获取、构建、权重与许可文件
└── docs/                 架构和实施计划
```

## Rapfi 集成原则

Rapfi 默认通过 Piskvork 文本协议通信，并支持 Yixin-Board 扩展。桌面开发阶段先采用独立进程适配器验证协议；移动端再将 C++ 核心编译为 ARM64 原生库；网页端编译为 WebAssembly。所有平台的上层 UI 只依赖 `shared/protocol/engine-contract.md` 中定义的统一事件。

首次准备引擎源码：

```bash
./engine/scripts/fetch-rapfi.sh
```

该脚本只获取官方源码及网络仓库，不会在当前步骤编译或修改上游代码。

## 当前状态

- 已固定并编译 macOS ARM64 Rapfi，网络权重全部保存在本地。
- HTML 第一版已经可运行，具备棋盘、双人、人机、摆盘、规则切换、候选、多步演示、局势图和分析强度。
- 本地适配服务会解析 Rapfi 的真实多候选输出；超时只返回最后完成的结果，不伪造评分。
- iOS 和 Android 已建立独立目录与原生接入边界，下一阶段实现 ARM64 C++ 桥接和移动端棋盘。

启动 HTML 第一版：

```bash
cd html
npm install
npm run local
```
