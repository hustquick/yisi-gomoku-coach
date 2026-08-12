#!/usr/bin/env python3
from hashlib import sha1
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def oid(name: str) -> str:
    return sha1(name.encode()).hexdigest().upper()[:24]


swift_files = [
    "App/Models.swift",
    "App/RapfiService.swift",
    "App/CoachViewModel.swift",
    "App/GomokuBoardView.swift",
    "App/SituationChartView.swift",
    "App/ContentView.swift",
    "App/YisiGomokuCoachApp.swift",
]
source_files = swift_files + ["Bridge/RapfiBridge.mm"]
resource_files = [
    "App/Resources/AppIcon.png",
    "App/Resources/config.toml",
    "App/Resources/model210901.bin",
    "App/Resources/mix9svqfreestyle_bsmix.bin.lz4",
    "App/Resources/mix9svqrenju_bs15_black.bin.lz4",
    "App/Resources/mix9svqrenju_bs15_white.bin.lz4",
    "App/Resources/mix9svqstandard_bs15.bin.lz4",
    "App/Resources/RAPFI-GPL-3.0.txt",
]

project_id = oid("project")
target_id = oid("target")
product_id = oid("product")
main_group = oid("main-group")
app_group = oid("app-group")
bridge_group = oid("bridge-group")
engine_group = oid("engine-group")
product_group = oid("product-group")
sources_phase = oid("sources-phase")
resources_phase = oid("resources-phase")
frameworks_phase = oid("frameworks-phase")
project_configs = oid("project-configs")
target_configs = oid("target-configs")
debug_project = oid("debug-project")
release_project = oid("release-project")
debug_target = oid("debug-target")
release_target = oid("release-target")
library_ref = oid("Rapfi.xcframework")
library_build = oid("Rapfi.xcframework-build")
info_ref = oid("Info.plist")
bridge_header_ref = oid("RapfiBridge.h")

file_refs = []
build_files = []
for path in source_files + resource_files:
    ref = oid("ref:" + path)
    ext = Path(path).suffix
    kind = {".swift": "sourcecode.swift", ".mm": "sourcecode.cpp.objcpp", ".png": "image.png", ".toml": "text", ".txt": "text"}.get(ext, "file")
    file_refs.append(f'\t\t{ref} /* {Path(path).name} */ = {{isa = PBXFileReference; lastKnownFileType = {kind}; path = {path}; sourceTree = "<group>"; }};')
    build = oid("build:" + path)
    phase = "Sources" if path in source_files else "Resources"
    build_files.append(f'\t\t{build} /* {Path(path).name} in {phase} */ = {{isa = PBXBuildFile; fileRef = {ref} /* {Path(path).name} */; }};')

app_children = [oid("ref:" + path) for path in swift_files] + [oid("ref:" + path) for path in resource_files] + [info_ref]
bridge_children = [oid("ref:Bridge/RapfiBridge.mm"), bridge_header_ref]
source_builds = [oid("build:" + path) for path in source_files]
resource_builds = [oid("build:" + path) for path in resource_files]

def entries(ids, names):
    return "\n".join(f"\t\t\t\t{item} /* {name} */," for item, name in zip(ids, names))

pbx = f'''// !$*UTF8*$!
{{
\tarchiveVersion = 1;
\tclasses = {{}};
\tobjectVersion = 77;
\tobjects = {{

/* Begin PBXBuildFile section */
{chr(10).join(build_files)}
\t\t{library_build} /* Rapfi.xcframework in Frameworks */ = {{isa = PBXBuildFile; fileRef = {library_ref} /* Rapfi.xcframework */; }};
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
{chr(10).join(file_refs)}
\t\t{info_ref} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = App/Info.plist; sourceTree = "<group>"; }};
\t\t{bridge_header_ref} /* RapfiBridge.h */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = Bridge/RapfiBridge.h; sourceTree = "<group>"; }};
\t\t{library_ref} /* Rapfi.xcframework */ = {{isa = PBXFileReference; lastKnownFileType = wrapper.xcframework; path = Engine/Rapfi.xcframework; sourceTree = "<group>"; }};
\t\t{product_id} /* YisiGomokuCoach.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = YisiGomokuCoach.app; sourceTree = BUILT_PRODUCTS_DIR; }};
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
\t\t{frameworks_phase} /* Frameworks */ = {{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = ({library_build} /* Rapfi.xcframework in Frameworks */,); runOnlyForDeploymentPostprocessing = 0; }};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
\t\t{main_group} = {{isa = PBXGroup; children = ({app_group} /* App */, {bridge_group} /* Bridge */, {engine_group} /* Engine */, {product_group} /* Products */,); sourceTree = "<group>"; }};
\t\t{app_group} /* App */ = {{isa = PBXGroup; children = (
{entries(app_children, [Path(p).name for p in swift_files + resource_files] + ["Info.plist"])}
\t\t\t); name = App; sourceTree = "<group>"; }};
\t\t{bridge_group} /* Bridge */ = {{isa = PBXGroup; children = (
{entries(bridge_children, ["RapfiBridge.mm", "RapfiBridge.h"])}
\t\t\t); name = Bridge; sourceTree = "<group>"; }};
\t\t{engine_group} /* Engine */ = {{isa = PBXGroup; children = ({library_ref} /* Rapfi.xcframework */,); name = Engine; sourceTree = "<group>"; }};
\t\t{product_group} /* Products */ = {{isa = PBXGroup; children = ({product_id} /* YisiGomokuCoach.app */,); name = Products; sourceTree = "<group>"; }};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
\t\t{target_id} /* YisiGomokuCoach */ = {{isa = PBXNativeTarget; buildConfigurationList = {target_configs}; buildPhases = ({sources_phase}, {frameworks_phase}, {resources_phase}); buildRules = (); dependencies = (); name = YisiGomokuCoach; productName = YisiGomokuCoach; productReference = {product_id}; productType = "com.apple.product-type.application"; }};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\t{project_id} /* Project object */ = {{isa = PBXProject; attributes = {{BuildIndependentTargetsInParallel = 1; LastSwiftUpdateCheck = 2650; LastUpgradeCheck = 2650; TargetAttributes = {{{target_id} = {{CreatedOnToolsVersion = 26.5; }}; }}; }}; buildConfigurationList = {project_configs}; developmentRegion = zh_CN; hasScannedForEncodings = 0; knownRegions = (zh_CN, en, Base); mainGroup = {main_group}; productRefGroup = {product_group}; projectDirPath = ""; projectRoot = ""; targets = ({target_id}); }};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
\t\t{resources_phase} /* Resources */ = {{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (
{entries(resource_builds, [Path(p).name + " in Resources" for p in resource_files])}
\t\t\t); runOnlyForDeploymentPostprocessing = 0; }};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
\t\t{sources_phase} /* Sources */ = {{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (
{entries(source_builds, [Path(p).name + " in Sources" for p in source_files])}
\t\t\t); runOnlyForDeploymentPostprocessing = 0; }};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
\t\t{debug_project} /* Debug */ = {{isa = XCBuildConfiguration; buildSettings = {{CLANG_CXX_LANGUAGE_STANDARD = "gnu++20"; CLANG_CXX_LIBRARY = "libc++"; DEBUG_INFORMATION_FORMAT = dwarf; ENABLE_TESTABILITY = YES; GCC_C_LANGUAGE_STANDARD = gnu17; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; }}; name = Debug; }};
\t\t{release_project} /* Release */ = {{isa = XCBuildConfiguration; buildSettings = {{CLANG_CXX_LANGUAGE_STANDARD = "gnu++20"; CLANG_CXX_LIBRARY = "libc++"; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"; ENABLE_NS_ASSERTIONS = NO; GCC_C_LANGUAGE_STANDARD = gnu17; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SDKROOT = iphoneos; VALIDATE_PRODUCT = YES; }}; name = Release; }};
\t\t{debug_target} /* Debug */ = {{isa = XCBuildConfiguration; buildSettings = {{ALWAYS_SEARCH_USER_PATHS = NO; ARCHS = arm64; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = BKLF8453MJ; HEADER_SEARCH_PATHS = ("$(inherited)", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi/external/cpptoml/include", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi/external/lz4/include", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi/external/simde/include"); INFOPLIST_FILE = App/Info.plist; IPHONEOS_DEPLOYMENT_TARGET = 17.0; LD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks"); LIBRARY_SEARCH_PATHS = ("$(inherited)", "$(PROJECT_DIR)/Engine"); MARKETING_VERSION = 1.0; OTHER_CPLUSPLUSFLAGS = ("$(inherited)", "-fexceptions", "-Wno-deprecated-enum-enum-conversion"); PRODUCT_BUNDLE_IDENTIFIER = com.yisi.gomokucoach; PRODUCT_NAME = "$(TARGET_NAME)"; SWIFT_OBJC_BRIDGING_HEADER = Bridge/RapfiBridge.h; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = 1; }}; name = Debug; }};
\t\t{release_target} /* Release */ = {{isa = XCBuildConfiguration; buildSettings = {{ALWAYS_SEARCH_USER_PATHS = NO; ARCHS = arm64; CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = 1; DEVELOPMENT_TEAM = BKLF8453MJ; HEADER_SEARCH_PATHS = ("$(inherited)", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi/external/cpptoml/include", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi/external/lz4/include", "$(PROJECT_DIR)/../engine/vendor/rapfi/Rapfi/external/simde/include"); INFOPLIST_FILE = App/Info.plist; IPHONEOS_DEPLOYMENT_TARGET = 17.0; LD_RUNPATH_SEARCH_PATHS = ("$(inherited)", "@executable_path/Frameworks"); LIBRARY_SEARCH_PATHS = ("$(inherited)", "$(PROJECT_DIR)/Engine"); MARKETING_VERSION = 1.0; OTHER_CPLUSPLUSFLAGS = ("$(inherited)", "-fexceptions", "-Wno-deprecated-enum-enum-conversion"); PRODUCT_BUNDLE_IDENTIFIER = com.yisi.gomokucoach; PRODUCT_NAME = "$(TARGET_NAME)"; SWIFT_OBJC_BRIDGING_HEADER = Bridge/RapfiBridge.h; SWIFT_OPTIMIZATION_LEVEL = "-O"; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = 1; }}; name = Release; }};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
\t\t{project_configs} = {{isa = XCConfigurationList; buildConfigurations = ({debug_project}, {release_project}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};
\t\t{target_configs} = {{isa = XCConfigurationList; buildConfigurations = ({debug_target}, {release_target}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }};
/* End XCConfigurationList section */
\t}};
\trootObject = {project_id};
}}
'''

project_dir = ROOT / "YisiGomokuCoach.xcodeproj"
project_dir.mkdir(parents=True, exist_ok=True)
(project_dir / "project.pbxproj").write_text(pbx)

scheme_dir = project_dir / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2650" version="1.7">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target_id}" BuildableName="YisiGomokuCoach.app" BlueprintName="YisiGomokuCoach" ReferencedContainer="container:YisiGomokuCoach.xcodeproj"/></BuildActionEntry></BuildActionEntries>
  </BuildAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target_id}" BuildableName="YisiGomokuCoach.app" BlueprintName="YisiGomokuCoach" ReferencedContainer="container:YisiGomokuCoach.xcodeproj"/></BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target_id}" BuildableName="YisiGomokuCoach.app" BlueprintName="YisiGomokuCoach" ReferencedContainer="container:YisiGomokuCoach.xcodeproj"/></BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
'''
(scheme_dir / "YisiGomokuCoach.xcscheme").write_text(scheme)
