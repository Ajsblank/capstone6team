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
#include <sw/redis++/redis++.h> // redis-plus-plus
#include <nlohmann/json.hpp>    // json

using json = nlohmann::json;
using namespace sw::redis;

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
            int time_limit_sec = data["timeLimitSec"];
            int memory_limit_mb = data["memoryLimitMB"];
            std::string work_dir = "./" + submission_id;

            std::cout << "▶ 제출 번호: " << submission_id << std::endl;

            system(("mkdir -p " + work_dir).c_str());

            // 유저가 제출한 단일 코드 저장
            write_file(work_dir + "/main.cpp", data["code"]);

            // 단일 파일 빌드용 Dockerfile 생성 (O2 최적화 옵션 포함)
            std::string docker_content =
                "FROM gcc:latest\n"
                "WORKDIR /app\n"
                "COPY main.cpp .\n"
                "RUN g++ -O2 -o solution main.cpp\n"
                "CMD [\"./solution\"]";
            write_file(work_dir + "/Dockerfile", docker_content);

            json result_json;
            result_json["submissionId"] = submission_id;

            // 도커 빌드 (컴파일 에러 검출)
            std::cout << "빌드 중..." << std::endl;
            CmdResult build_res = exec_cmd("docker build -t " + submission_id + " " + work_dir + " 2>&1");
            if (build_res.exit_code != 0) {
                std::cout << "[결과] ❌ 컴파일 에러!" << std::endl;
                result_json["status"] = "COMPILE_ERROR";
                result_json["log"] = build_res.output;
                redis.lpush("algorithms_result_queue", result_json.dump());
                system(("rm -rf " + work_dir).c_str());
                continue;
            }

            // 테스트 케이스 반복 채점 로직
            bool is_accepted = true;
            int tc_count = data["testcases"].size();
            std::cout << "총 " << tc_count << "개의 테스트 케이스 채점 시작..." << std::endl;

            for (int i = 0; i < tc_count; ++i) {
                std::string tc_input = data["testcases"][i]["input"];
                std::string expected_output = data["testcases"][i]["output"];

                // 입력 데이터를 파일로 저장 (도커 컨테이너에 표준 입력으로 밀어넣기 위함)
                write_file(work_dir + "/in.txt", tc_input);

                // 도커 실행 시 `< in.txt` 를 통해 표준 입력을 제공
                std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                      "docker run -i --rm --memory=" + std::to_string(memory_limit_mb) + "m --network=none " + submission_id + 
                                      " < " + work_dir + "/in.txt";
                
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

                if (trim(run_res.output) != trim(expected_output)) {
                    std::cout << "[TC " << i+1 << "] ❌ 틀렸습니다!" << std::endl;
                    result_json["status"] = "WRONG_ANSWER";
                    is_accepted = false;
                    break;
                } else {
                    std::cout << "[TC " << i+1 << "] ✅ 통과" << std::endl;
                }
            }

            if (is_accepted) {
                std::cout << "[최종 결과] 🎉 맞았습니다! (ACCEPTED)" << std::endl;
                result_json["status"] = "ACCEPTED";
            }

            redis.lpush("algorithms_result_queue", result_json.dump());
            system(("docker rmi " + submission_id + " > /dev/null 2>&1 && rm -rf " + work_dir).c_str());
        }
    } catch (const sw::redis::Error &e) {
        std::cerr << "Redis 에러 발생: " << e.what() << std::endl;
    }

    return 0;
}