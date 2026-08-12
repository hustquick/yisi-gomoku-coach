#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
engine_dir="$(cd "${script_dir}/.." && pwd)"
source_dir="${engine_dir}/vendor/rapfi/Rapfi"
network_dir="${engine_dir}/vendor/rapfi-networks"
build_dir="${source_dir}/build/arm64-make"
runtime_dir="${engine_dir}/runtime/macos-arm64"

if [[ ! -f "${source_dir}/CMakeLists.txt" || ! -d "${network_dir}/mix9svq" ]]; then
  echo "Rapfi 源码或网络文件不存在，请先运行 fetch-rapfi.sh。" >&2
  exit 1
fi

cmake -S "${source_dir}" -B "${build_dir}" -G "Unix Makefiles" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_C_COMPILER=clang \
  -DCMAKE_CXX_COMPILER=clang++ \
  -DUSE_NEON=ON \
  -DUSE_NEON_DOTPROD=ON
cmake --build "${build_dir}" -j "$(sysctl -n hw.logicalcpu)"

mkdir -p "${runtime_dir}"
cp "${build_dir}/pbrain-rapfi" "${runtime_dir}/"
cp "${network_dir}/config-example/config.toml" "${runtime_dir}/"
cp "${network_dir}/classical/model210901.bin" "${runtime_dir}/"
cp "${network_dir}/mix9svq/"*.bin.lz4 "${runtime_dir}/"
cp "${engine_dir}/vendor/rapfi/Copying.txt" "${runtime_dir}/RAPFI-GPL-3.0.txt"

printf 'START 15\nEND\n' | "${runtime_dir}/pbrain-rapfi"

