#include "RapfiBridge.h"

#include "command/command.h"
#include "search/searchthread.h"

#include <atomic>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>

namespace Command::GomocupProtocol {
bool runProtocol();
}

namespace {
std::mutex engineMutex;
std::string result;
std::atomic_bool initialized{false};

std::string escapeJSON(const std::string &value)
{
    std::string output;
    output.reserve(value.size() + 16);
    for (char character : value) {
        switch (character) {
        case '\\': output += "\\\\"; break;
        case '"': output += "\\\""; break;
        case '\n': output += "\\n"; break;
        case '\r': break;
        case '\t': output += "\\t"; break;
        default: output += character; break;
        }
    }
    return output;
}
}

extern "C" const char *rf_initialize(const char *configPath)
{
    std::lock_guard<std::mutex> lock(engineMutex);
    if (initialized) {
        result = "ready";
        return result.c_str();
    }
    try {
        char program[] = "rapfi-ios";
        char *arguments[] = {program, nullptr};
        Command::CommandLine::init(1, arguments);
        Command::configPath = configPath ? configPath : "config.toml";
        Command::allowInternalConfig = false;
        const bool loaded = Command::loadConfig();
        initialized.store(loaded, std::memory_order_release);
        result = loaded ? "ready" : "error:无法载入 Rapfi 配置";
    }
    catch (const std::exception &error) {
        result = "error:" + std::string(error.what());
    }
    return result.c_str();
}

extern "C" const char *rf_analyze(const char *commandText)
{
    std::lock_guard<std::mutex> lock(engineMutex);
    if (!initialized.load(std::memory_order_acquire)) {
        result = "{\"lines\":[],\"error\":\"Rapfi 尚未初始化\"}";
        return result.c_str();
    }

    try {
        std::istringstream input(commandText ? commandText : "");
        std::ostringstream output;
        auto *oldInput = std::cin.rdbuf(input.rdbuf());
        auto *oldOutput = std::cout.rdbuf(output.rdbuf());
        std::cin.clear();
        std::cout.clear();

        while (input >> std::ws && input.peek() != std::char_traits<char>::eof())
            Command::GomocupProtocol::runProtocol();
        Search::Engine.waitForIdle();
        std::cout.flush();

        std::cin.rdbuf(oldInput);
        std::cout.rdbuf(oldOutput);
        std::cin.clear();
        std::cout.clear();
        result = output.str();
    }
    catch (const std::exception &error) {
        result = "ERROR:" + escapeJSON(error.what());
    }
    return result.c_str();
}

extern "C" void rf_stop(void)
{
    if (initialized.load(std::memory_order_acquire))
        Search::Engine.stopThinking();
}
