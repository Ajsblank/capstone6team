#include <iostream>
#include <fstream>
#include <string>
#include <cstdlib>
#include <sys/wait.h>
#include <cstdio>
#include <memory>
#include <stdexcept>
#include <vector>
#include <algorithm>
#include <regex>
#include <filesystem>
#include <sw/redis++/redis++.h> // redis-plus-plus
#include <nlohmann/json.hpp>    // json

using json = nlohmann::json;
using namespace sw::redis;
namespace fs = std::filesystem;

struct CmdResult {
    std::string output;
    int exit_code;
};

void write_file(const std::string& path, const std::string& content) {
    std::ofstream ofs(path);
    if (ofs.is_open()) {
        ofs << content;
        ofs.close();
    }
}

// 문자열 앞뒤의 공백/줄바꿈을 제거하는 함수
std::string trim(const std::string& str) {
    size_t first = str.find_first_not_of(" \n\r\t");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \n\r\t");
    return str.substr(first, (last - first + 1));
}

CmdResult exec_cmd(const std::string& cmd) {
    char buffer[256];
    std::string result = "";
    
    // 표준 에러(stderr)는 제외하고 표준 출력(stdout)만 잡습니다. (정답 비교를 위함)
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return {"popen() failed", -1};

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
    }
    
    int status = pclose(pipe);
    return {result, WEXITSTATUS(status)};
}

int main() {
    try {
        auto redis = Redis("tcp://127.0.0.1:6379");
        std::cout << "[Algorithms Worker] 알고리즘 채점 서버 시작...\n";

        while (true) {
            // 게임 서버와 큐 이름을 분리합니다.
            auto item = redis.brpop("algorithms_grading_queue", 0);
            if (!item) continue;

            json data = json::parse(item->second);

            std::string submission_id = data["submissionId"];
            std::regex valid_id_regex("^[a-z0-9_-]+$");
            if (!std::regex_match(submission_id, valid_id_regex)) {
                std::cout << "[보안 경고] 유효하지 않은 submissionId : " << submission_id << std::endl;
                continue;
            }
            int time_limit_sec = data["timeLimitSec"];
            int memory_limit_mb = data["memoryLimitMB"];
            std::string work_dir = "./" + submission_id;
            std::string abs_work_dir = fs::absolute(work_dir).string();

            std::cout << "▶ 제출 번호: " << submission_id << std::endl;

            std::error_code ec;
            fs::create_directories(work_dir, ec);
            if (ec) {
                std::cerr << "폴더 생성 실패: " << ec.message() << std::endl;
                continue;
            }

            // 유저가 제출한 단일 코드 저장
            write_file(work_dir + "/main.cpp", data["code"]);

            // 런타임/메모리 측정용 감시자(Runner) 코드 주입
            std::string runner_code = R"(
                #include <iostream>
                #include <sys/time.h>
                #include <sys/resource.h>
                #include <sys/wait.h>
                #include <unistd.h>
                #include <stdio.h>
                
                int main(int argc, char* argv[]) {
                    if (argc < 2) return 1;
                    struct timeval start, end;
                    gettimeofday(&start, NULL);
                    
                    pid_t pid = fork();
                    if (pid == 0) {
                        execvp(argv[1], argv+1); // 유저 코드 실행
                        perror("execvp failed"); // 혹시 실행 실패하면 이유를 출력
                        return 1;
                    }
                    
                    int status;
                    struct rusage usage;
                    wait4(pid, &status, 0, &usage);
                    gettimeofday(&end, NULL);
                    
                    long ms = (end.tv_sec - start.tv_sec) * 1000 + (end.tv_usec - start.tv_usec) / 1000;
                    long mem_kb = usage.ru_maxrss;
                    
                    // 정답 텍스트와 겹치지 않게 무조건 줄바꿈(\n) 후 출력
                    std::cerr << "\n[STATS]" << ms << "," << mem_kb << std::endl; 
                    return WEXITSTATUS(status);
                }
                )";

            write_file(work_dir + "/runner.cpp", runner_code);

            json result_json;
            result_json["submissionId"] = submission_id;

            // 도커 빌드 (컴파일 에러 검출)
            std::cout << "빌드 중..." << std::endl;
            std::string compile_cmd = "docker run --rm -v " + abs_work_dir + ":/app -w /app gcc:latest " +
                                      "sh -c \"g++ -O2 -o solution main.cpp && g++ -O2 -o runner runner.cpp && chmod 777 solution runner\" 2>&1";
            CmdResult build_res = exec_cmd(compile_cmd);
            if (build_res.exit_code != 0) {
                std::cout << "[결과] ⚠️ 컴파일 에러!" << std::endl;
                result_json["status"] = "COMPILE_ERROR";
                result_json["log"] = build_res.output;
                redis.lpush("algorithms_result_queue", result_json.dump());
                
                fs::remove_all(work_dir, ec);
                continue;
            }

            // 테스트 케이스 반복 채점 로직
            bool is_accepted = true;
            int max_time_ms = 0;
            int max_memory_kb = 0;
            int tc_count = data["testcases"].size();
            std::cout << "총 " << tc_count << "개의 테스트 케이스 채점 시작..." << std::endl;

            for (int i = 0; i < tc_count; ++i) {
                std::string tc_input = data["testcases"][i]["input"];
                std::string expected_output = data["testcases"][i]["output"];

                // 입력 데이터를 파일로 저장 (도커 컨테이너에 표준 입력으로 밀어넣기 위함)
                write_file(work_dir + "/in.txt", tc_input);

                // 도커 실행 시 `< in.txt` 를 통해 표준 입력을 제공
                std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                      "docker run -i --rm -v " + abs_work_dir + ":/app -w /app " +
                                      "--memory=" + std::to_string(memory_limit_mb) + "m --network=none gcc:latest " + 
                                      "./runner ./solution < " + abs_work_dir + "/in.txt 2>&1";
                
                CmdResult run_res = exec_cmd(run_cmd);

                // 에러 처리
                if (run_res.exit_code == 124) {
                    std::cout << "[TC " << i+1 << "] ❌ 시간 초과!" << std::endl;
                    result_json["status"] = "TIME_LIMIT_EXCEEDED";
                    is_accepted = false;
                    break;
                } else if (run_res.exit_code == 137) {
                    std::cout << "[TC " << i+1 << "] ❌ 메모리 초과 (OOM)!" << std::endl;
                    result_json["status"] = "MEMORY_LIMIT_EXCEEDED";
                    is_accepted = false;
                    break;
                } else if (run_res.exit_code != 0) {
                    std::cout << "[TC " << i+1 << "] ⚠️ 런타임 에러!" << std::endl;
                    result_json["status"] = "RUNTIME_ERROR";
                    is_accepted = false;
                    break;
                }

                int cur_time = 0, cur_mem = 0;
                std::string final_output = "";
                
                size_t stats_pos = run_res.output.rfind("[STATS]"); 
                if (stats_pos != std::string::npos) {
                    std::string stats_str = run_res.output.substr(stats_pos + 7);
                    size_t comma_idx = stats_str.find(",");
                    if (comma_idx != std::string::npos) {
                        try {
                            cur_time = std::stoi(stats_str.substr(0, comma_idx));
                            cur_mem = std::stoi(stats_str.substr(comma_idx + 1));
                        } catch (...) {}
                    }
                    final_output = run_res.output.substr(0, stats_pos);
                }

                max_time_ms = std::max(max_time_ms, cur_time);
                max_memory_kb = std::max(max_memory_kb, cur_mem);

                if (trim(final_output) != trim(expected_output)) {
                    std::cout << "[TC " << i+1 << "] ❌ 틀렸습니다!" << std::endl;
                    result_json["status"] = "WRONG_ANSWER";
                    is_accepted = false;
                    break;
                } else {
                    std::cout << "[TC " << i+1 << "] ✅ 통과 (" << cur_time << "ms, " << cur_mem << "KB)" << std::endl;
                }
            }

            if (is_accepted) {
                std::cout << "[최종 결과] 🎉 맞았습니다! (ACCEPTED)" << std::endl;
                result_json["status"] = "ACCEPTED";
                result_json["executionTimeMs"] = max_time_ms;
                result_json["memoryUsageKB"] = max_memory_kb;
            }

            redis.lpush("algorithms_result_queue", result_json.dump());
            fs::remove_all(work_dir, ec);
        }
    } catch (const sw::redis::Error &e) {
        std::cerr << "Redis 에러 발생: " << e.what() << std::endl;
    }

    return 0;
}