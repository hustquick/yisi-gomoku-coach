# 弈思五子棋教练 iOS 版

原生 SwiftUI 应用。Rapfi C++17 引擎通过 Objective-C++ 桥接在应用进程内运行，配置和四套神经网络均随 App 打包，离线可用。

## 已实现

- 15×15 棋盘，横线 A–O、纵线由近到远 1–15
- 双人对弈、人机对战和摆盘
- 自由五子棋、标准五子棋和连珠规则
- 深度 8/10/12/14/16，本地多线程分析，思考期间仍可落子
- “优”按钮显示全局候选落点及序号
- 候选按行棋方评分排序；单击播放 1a、1b、2a、2b 变化，双击执行着法
- 胜势、优势、稍优和均势分级；强制胜法与终局优先显示
- 局势图、滑移回看、历史局面评分后台补算
- 悔棋、重开和一键黑白视角倒置

## 构建

```bash
./tools/build-rapfi-ios.sh
./tools/generate-project.py
xcodebuild -project YisiGomokuCoach.xcodeproj \
  -scheme YisiGomokuCoach \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' build
```

`build-rapfi-ios.sh` 会生成同时支持真机 arm64 和 Apple Silicon 模拟器的 `Engine/Rapfi.xcframework`。

首次真机安装需要在 Xcode 的 Accounts 中登录 Apple ID，让 Xcode 为 `com.yisi.gomokucoach` 创建开发描述文件。项目当前最低支持 iOS 17。
