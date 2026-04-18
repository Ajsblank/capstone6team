#include <iostream>
#include <fstream>
#include <string>
#include <cstdlib>
#include <sys/wait.h>
#include <cstdio>
#include <memory>
#include <stdexcept>
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

CmdResult exec_cmd(const std::string& cmd) {
    char buffer[128];
    std::string result = "";
    
    FILE* pipe = popen(cmd.c_str(), "r");
    if (!pipe) return {"popen() 실패", -1};

    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
        std::cout << buffer;
    }
    
    int status = pclose(pipe);
    return {result, WEXITSTATUS(status)};
}

int main() {
    try {
        // Redis 연결 설정
        auto redis = Redis("tcp://127.0.0.1:6379");
        std::cout << "[Worker] 채점 서버가 시작되었습니다. 작업을 대기합니다...\n";

        while (true) {
            // Redis List에서 작업 가져오기 (Blocking Pop)
            auto item = redis.brpop("grading_queue", 0);
            if (!item) continue;

            std::string json_str = item->second;
            json data = json::parse(json_str);

            std::string match_id = data["matchId"];
            int time_limit_sec = data["timeLimitSec"];
            std::string work_dir = "./" + match_id;

            std::cout << "▶ 매치 ID: " << match_id << " (제한시간: " << time_limit_sec << "초)" << std::endl;

            // 작업 폴더 생성
            system(("mkdir -p " + work_dir).c_str());

            // C++ 코드 생성
            write_file(work_dir + "/judge.cpp", data["codes"]["judge"]);
            write_file(work_dir + "/player1.cpp", data["codes"]["player1"]);
            write_file(work_dir + "/player2.cpp", data["codes"]["player2"]);

            // Dockerfile 생성
            std::string docker_content =
                "FROM gcc:latest\n"
                "WORKDIR /app\n"
                "COPY . /app\n"
                "RUN g++ -o judge judge.cpp && g++ -o player1 player1.cpp && g++ -o player2 player2.cpp\n"
                "CMD [\"./judge\", \"./player1\", \"./player2\"]";
            write_file(work_dir + "/Dockerfile", docker_content);

            json result_json;
            result_json["matchId"] = match_id;

            // 도커 빌드 및 실행
            std::cout << "빌드 중..." << std::endl;
            std::string build_cmd = "docker build -t " + match_id + " " + work_dir + " 2>&1";
            CmdResult build_res = exec_cmd(build_cmd);
            if (build_res.exit_code != 0) {
                result_json["status"] = "COMPILE_ERROR";
                result_json["log"] = build_res.output;
                redis.lpush("result_queue", result_json.dump());
                system(("rm -rf " + work_dir).c_str());
                continue;
            }

            std::cout << "실행 및 채점 중..." << std::endl;
            std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                  "docker run --rm --memory=512m --network=none " + match_id;
            CmdResult run_res = exec_cmd(run_cmd);
            result_json["log"] = run_res.output;

            // 결과 판정 및 Redis에 최종 결과 전송
            if (run_res.exit_code == 124) {
                std::cout << "[결과] ❌ 전체 시간 초과 (Timeout)!" << std::endl;
                result_json["status"] = "TIME_LIMIT_EXCEEDED";
            }
            else if (run_res.exit_code == 0) {
                std::cout << "[결과] ✅ 정상 종료!" << std::endl;
                result_json["status"] = "SUCCESS";
            }
            else {
                std::cout << "[결과] ⚠️ 런타임 에러 (Exit Code: " << run_res.exit_code << ")" << std::endl;
                result_json["status"] = "RUNTIME_ERROR";
            }

            // 스프링부트가 읽을 수 있게 결과 큐(result_queue)에 PUSH
            redis.lpush("result_queue", result_json.dump());

            // 이미지 및 임시 폴더 삭제
            std::cout << "▶ 자원 정리 중..." << std::endl;
            std::string cleanup_cmd = "docker rmi " + match_id + " > /dev/null 2>&1 && rm -rf " + work_dir;
            system(cleanup_cmd.c_str());
            
            std::cout << "▶ 매치 처리 완료. 다음 대결을 대기합니다." << std::endl;
        }
    } catch (const Error &e) {
        std::cerr << "Redis 에러 발생: " << e.what() << std::endl;
    }

    return 0;
}