弈思五子棋教练 · Windows HTML 离线版
======================================

运行方法
--------
1. 将压缩包完整解压到一个普通文件夹。
2. 双击 index.html。
3. 建议使用最新版 Microsoft Edge 或 Google Chrome 打开。
4. 首次载入本地 Rapfi 引擎可能需要数秒；此过程不需要联网。

请勿只复制 index.html。index.html、app.js、style.css 和 rapfi.js 必须保持在同一文件夹。

主要功能
--------
- 15×15 棋盘与 A–O、1–15 坐标
- 双人对弈、人机对战、自由摆盘
- 自由五子棋、标准五子棋、连珠规则
- 本地 Rapfi 候选、评分、胜率、深度和最多 9 回合的变化演示
- 单击候选演示变化，双击候选执行第一手
- 全局“优”候选、悔棋、重开、前后步和黑白视角切换
- 局势图、历史局面选择和缺失评分后台补算
- 分析深度 8、10、12、14、16 可选

离线说明
--------
本版将 Rapfi 编译为 WebAssembly，并将运行代码和网络权重封装在 rapfi.js 中。
所有核心计算都在本机浏览器内完成，不会把棋谱上传到网络。

兼容性
------
- Windows 10/11
- 64 位 Microsoft Edge 或 Google Chrome
- 浏览器需支持 WebAssembly SIMD、Blob Worker 和 ES2020

如果浏览器阻止本地文件运行，请确认压缩包已经完整解压，不要直接在压缩包预览窗口内双击。
部分安全软件会延迟扫描约 61 MB 的 rapfi.js，这是正常现象。

开源许可
--------
Rapfi 按 GNU GPL v3 分发，许可全文见 Rapfi-GPL-3.0.txt。
网络权重许可见 rapfi-networks-LICENSE.txt。
对应源码与版本信息见 RAPFI-SOURCE.txt。

