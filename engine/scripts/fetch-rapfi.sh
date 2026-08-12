#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
engine_dir="$(cd "${script_dir}/.." && pwd)"
vendor_dir="${engine_dir}/vendor"

mkdir -p "${vendor_dir}"

if [[ ! -d "${vendor_dir}/rapfi/.git" ]]; then
  git clone --depth 1 https://github.com/dhbloo/rapfi.git "${vendor_dir}/rapfi"
fi

if [[ ! -d "${vendor_dir}/rapfi-networks/.git" ]]; then
  git clone --depth 1 https://github.com/dhbloo/rapfi-networks.git "${vendor_dir}/rapfi-networks"
fi

git -C "${vendor_dir}/rapfi" rev-parse HEAD
git -C "${vendor_dir}/rapfi-networks" rev-parse HEAD

