#include "RapfiBridge.h"

#include <iostream>
#include <string>

int main(int argc, char **argv)
{
    if (argc != 2) {
        std::cerr << "usage: rapfi_bridge_smoke CONFIG" << std::endl;
        return 2;
    }
    std::string ready = rf_initialize(argv[1]);
    if (ready != "ready") {
        std::cerr << ready << std::endl;
        return 3;
    }
    const char *commands =
        "START 15\nYXSHOWINFO\nINFO RULE 0\nINFO TIMEOUT_TURN 1200\n"
        "INFO MAX_DEPTH 6\nINFO SHOW_DETAIL 2\nINFO THREAD_NUM 2\n"
        "YXBOARD\n7,7,1\nDONE\nYXNBEST 3\n";
    std::string output = rf_analyze(commands);
    std::cout << output;
    return output.find("INFO PV DONE") == std::string::npos ? 4 : 0;
}
