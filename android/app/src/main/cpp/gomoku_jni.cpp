#include <jni.h>

#include "command/command.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <csignal>
#include <fcntl.h>
#include <poll.h>
#include <string>
#include <sys/wait.h>
#include <unistd.h>

namespace {
std::atomic<pid_t> activeChild {-1};

std::string fromJava(JNIEnv *env, jstring value)
{
    if (!value)
        return {};
    const char *chars = env->GetStringUTFChars(value, nullptr);
    std::string result(chars ? chars : "");
    if (chars)
        env->ReleaseStringUTFChars(value, chars);
    return result;
}

bool writeAll(int fd, const std::string &text)
{
    size_t offset = 0;
    while (offset < text.size()) {
        ssize_t count = write(fd, text.data() + offset, text.size() - offset);
        if (count <= 0)
            return false;
        offset += static_cast<size_t>(count);
    }
    return true;
}
}  // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_yisi_gomokucoach_RapfiNative_analyze(
    JNIEnv *env, jclass, jstring configPathValue, jstring commandsValue, jint timeoutMs)
{
    std::string configPath = fromJava(env, configPathValue);
    std::string commands   = fromJava(env, commandsValue);
    int inputPipe[2], outputPipe[2];
    if (pipe(inputPipe) != 0 || pipe(outputPipe) != 0)
        return env->NewStringUTF("ERROR:无法创建 Rapfi 通道");

    pid_t child = fork();
    if (child < 0)
        return env->NewStringUTF("ERROR:无法启动 Rapfi");
    if (child == 0) {
        dup2(inputPipe[0], STDIN_FILENO);
        dup2(outputPipe[1], STDOUT_FILENO);
        dup2(outputPipe[1], STDERR_FILENO);
        close(inputPipe[0]);
        close(inputPipe[1]);
        close(outputPipe[0]);
        close(outputPipe[1]);

        std::string directory = configPath.substr(0, configPath.find_last_of('/'));
        chdir(directory.c_str());
        char program[] = "rapfi";
        char *argv[]   = {program, nullptr};
        Command::CommandLine::init(1, argv);
        Command::configPath          = configPath;
        Command::allowInternalConfig = false;
        if (!Command::loadConfig())
            _exit(2);
        Command::gomocupLoop();
        _exit(0);
    }

    activeChild.store(child);
    close(inputPipe[0]);
    close(outputPipe[1]);
    fcntl(outputPipe[0], F_SETFL, fcntl(outputPipe[0], F_GETFL, 0) | O_NONBLOCK);
    writeAll(inputPipe[1], commands);
    close(inputPipe[1]);

    std::string output;
    auto deadline = std::chrono::steady_clock::now() +
                    std::chrono::milliseconds(std::max(1000, static_cast<int>(timeoutMs)));
    bool finished = false;
    while (std::chrono::steady_clock::now() < deadline) {
        pollfd descriptor {outputPipe[0], POLLIN | POLLHUP, 0};
        int ready = poll(&descriptor, 1, 100);
        if (ready > 0 && (descriptor.revents & (POLLIN | POLLHUP))) {
            char buffer[8192];
            ssize_t count;
            while ((count = read(outputPipe[0], buffer, sizeof(buffer))) > 0)
                output.append(buffer, static_cast<size_t>(count));
        }
        int status = 0;
        pid_t result = waitpid(child, &status, WNOHANG);
        if (result == child) {
            finished = true;
            break;
        }
    }
    if (!finished) {
        kill(child, SIGTERM);
        usleep(120000);
        if (waitpid(child, nullptr, WNOHANG) == 0)
            kill(child, SIGKILL);
        waitpid(child, nullptr, 0);
    }
    close(outputPipe[0]);
    activeChild.compare_exchange_strong(child, -1);
    if (!finished && output.empty())
        output = "ERROR:Rapfi 计算超时";
    return env->NewStringUTF(output.c_str());
}

extern "C" JNIEXPORT void JNICALL
Java_com_yisi_gomokucoach_RapfiNative_stop(JNIEnv *, jclass)
{
    pid_t child = activeChild.exchange(-1);
    if (child > 0)
        kill(child, SIGTERM);
}
