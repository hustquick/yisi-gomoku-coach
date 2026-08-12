package com.yisi.gomokucoach;

final class RapfiNative {
    static { System.loadLibrary("rapfi_jni"); }
    static native String analyze(String configPath, String commands, int timeoutMs);
    static native void stop();
    private RapfiNative() {}
}
