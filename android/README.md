# 弈思五子棋教练 Android 版

原生 Android 应用，使用 Java 自定义棋盘和图表，并通过 CMake/JNI 在设备本地运行 Rapfi C++ 引擎。APK 已内置配置、模型和神经网络文件，分析时不依赖网络。

## 已实现

- 15×15 棋盘，横线 A–O、纵线由近到远 1–15
- 双人对弈、人机对战、摆盘
- 自由五子棋、标准五子棋、连珠规则
- 可选分析深度、全局最优落点、候选排序和变化动画
- 悔棋、重开、红黑视角倒置
- 局势图和未完成历史评分的后台补算
- 已形成五连或 Rapfi 算出强制胜法时显示胜负/胜势，不降级为“稍优”

## 构建

```bash
./gradlew clean assembleDebug
```

生成文件：`app/build/outputs/apk/debug/app-debug.apk`。

当前仅构建 `arm64-v8a`，最低 Android 8.0（API 26）。Debug APK 使用 Android 调试证书签名，可直接侧载测试；正式分发应改用自己的 release keystore。
