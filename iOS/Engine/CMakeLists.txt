cmake_minimum_required(VERSION 3.22)
project(RapfiIOS LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

set(RAPFI_ROOT "${CMAKE_CURRENT_LIST_DIR}/../../engine/vendor/rapfi/Rapfi")
set(RAPFI_SOURCES
    ${RAPFI_ROOT}/command/argutils.cpp
    ${RAPFI_ROOT}/command/benchmark.cpp
    ${RAPFI_ROOT}/command/command.cpp
    ${RAPFI_ROOT}/command/dbcommand.cpp
    ${RAPFI_ROOT}/command/gomocup.cpp
    ${RAPFI_ROOT}/core/compressor.cpp
    ${RAPFI_ROOT}/core/hash.cpp
    ${RAPFI_ROOT}/core/iohelper.cpp
    ${RAPFI_ROOT}/core/platform.cpp
    ${RAPFI_ROOT}/core/utils.cpp
    ${RAPFI_ROOT}/core/version.cpp
    ${RAPFI_ROOT}/database/dbclient.cpp
    ${RAPFI_ROOT}/database/dbconfig.cpp
    ${RAPFI_ROOT}/database/dbtypes.cpp
    ${RAPFI_ROOT}/database/dbutils.cpp
    ${RAPFI_ROOT}/database/renlib.cpp
    ${RAPFI_ROOT}/database/yxdbstorage.cpp
    ${RAPFI_ROOT}/eval/eval.cpp
    ${RAPFI_ROOT}/eval/evalconfig.cpp
    ${RAPFI_ROOT}/eval/evaluator.cpp
    ${RAPFI_ROOT}/eval/mix9svqnnue.cpp
    ${RAPFI_ROOT}/eval/mix10nnue.cpp
    ${RAPFI_ROOT}/game/board.cpp
    ${RAPFI_ROOT}/game/movegen.cpp
    ${RAPFI_ROOT}/game/pattern.cpp
    ${RAPFI_ROOT}/search/hashtable.cpp
    ${RAPFI_ROOT}/search/movepick.cpp
    ${RAPFI_ROOT}/search/opening.cpp
    ${RAPFI_ROOT}/search/searchcommon.cpp
    ${RAPFI_ROOT}/search/searchconfig.cpp
    ${RAPFI_ROOT}/search/searchengine.cpp
    ${RAPFI_ROOT}/search/searchoutput.cpp
    ${RAPFI_ROOT}/search/searchthread.cpp
    ${RAPFI_ROOT}/search/timecontrol.cpp
    ${RAPFI_ROOT}/search/ab/history.cpp
    ${RAPFI_ROOT}/search/ab/search.cpp
    ${RAPFI_ROOT}/search/mcts/node.cpp
    ${RAPFI_ROOT}/search/mcts/search.cpp
    ${RAPFI_ROOT}/config.cpp
    ${RAPFI_ROOT}/internalConfig.cpp
    ${RAPFI_ROOT}/external/lz4/src/lz4_all.c
    ${RAPFI_ROOT}/external/lz4/src/xxhash.c
)

add_library(rapfi_ios STATIC ${RAPFI_SOURCES})
target_include_directories(rapfi_ios PUBLIC
    ${RAPFI_ROOT}
    ${RAPFI_ROOT}/external/cpptoml/include
    ${RAPFI_ROOT}/external/lz4/include
    ${RAPFI_ROOT}/external/simde/include
)
target_compile_definitions(rapfi_ios PRIVATE MULTI_THREADING USE_NEON NO_PREFETCH)
target_compile_options(rapfi_ios PRIVATE -O3 -fexceptions -ffp-contract=off)

option(RAPFI_BUILD_BRIDGE_SMOKE "Build the in-process bridge smoke test" OFF)
if(RAPFI_BUILD_BRIDGE_SMOKE)
    set_source_files_properties(${CMAKE_CURRENT_LIST_DIR}/../Bridge/RapfiBridge.mm PROPERTIES LANGUAGE CXX)
    add_executable(rapfi_bridge_smoke
        ${CMAKE_CURRENT_LIST_DIR}/../Bridge/RapfiBridge.mm
        ${CMAKE_CURRENT_LIST_DIR}/../Tests/BridgeSmoke.cpp
    )
    target_include_directories(rapfi_bridge_smoke PRIVATE ${CMAKE_CURRENT_LIST_DIR}/../Bridge)
    target_link_libraries(rapfi_bridge_smoke PRIVATE rapfi_ios)
endif()
