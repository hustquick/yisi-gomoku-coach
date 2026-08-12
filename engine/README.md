# Rapfi 引擎目录

- `vendor/rapfi/`：官方 Rapfi 源码，下载后不提交到当前仓库。
- `vendor/rapfi-networks/`：官方网络权重与配置。
- `runtime/`：本机和测试设备的构建产物。
- `scripts/fetch-rapfi.sh`：获取固定来源的辅助脚本。
- `scripts/build-macos-arm64.sh`：用 Apple Clang 构建本地 ARM64 基准引擎，并把配置、权重和许可复制到 `runtime/macos-arm64/`。

发布任何包含 Rapfi 二进制的安装包时，必须同时提供 GPL-3.0 许可和可生成该二进制的精确源码（或明确源码指针），并公开对 Rapfi 源码所作的修改。
