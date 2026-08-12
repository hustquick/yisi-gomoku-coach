#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
IOS_DIR=${SCRIPT_DIR:h}
DEVICE_BUILD_DIR="$IOS_DIR/build/rapfi-iphoneos"
SIMULATOR_BUILD_DIR="$IOS_DIR/build/rapfi-iphonesimulator"

cmake -S "$IOS_DIR/Engine" -B "$DEVICE_BUILD_DIR" -G "Unix Makefiles" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphoneos \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=17.0
cmake --build "$DEVICE_BUILD_DIR" --parallel

cmake -S "$IOS_DIR/Engine" -B "$SIMULATOR_BUILD_DIR" -G "Unix Makefiles" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphonesimulator \
  -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=17.0
cmake --build "$SIMULATOR_BUILD_DIR" --parallel

cmake -E remove_directory "$IOS_DIR/Engine/Rapfi.xcframework"
xcodebuild -create-xcframework \
  -library "$DEVICE_BUILD_DIR/librapfi_ios.a" \
  -library "$SIMULATOR_BUILD_DIR/librapfi_ios.a" \
  -output "$IOS_DIR/Engine/Rapfi.xcframework"
