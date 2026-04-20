#include <iostream>
#include <fstream>
#include <string>
#include <cstdlib>
#include <sys/wait.h>
#include <cstdio>
#include <memory>
#include <stdexcept>
#include <filesystem>
#include <regex>
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

CmdResult exec_cmd(const std::string& cmd) {
    char buffer[128];
    std::string result = "";
    
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
        // Redis 연결 설정
        auto redis = Redis("tcp://127.0.0.1:6379");
        std::cout << "[Worker] 코드 배틀 서버 시작...\n";

        while (true) {
            auto item = redis.brpop("code_battle_queue", 0);
            if (!item) continue;

            std::string json_str = item->second;
            json data = json::parse(json_str);

            std::string match_id = data["matchId"];

            std::regex valid_id_regex("^[a-zA-Z0-9_-]+$");
            if (!std::regex_match(match_id, valid_id_regex)) {
                std::cout << "[보안 경고] 유효하지 않은 matchId : " << match_id << std::endl;
                continue;
            }
            
            int time_limit_sec = data["timeLimitSec"];
            std::string work_dir = "./" + match_id;
            std::string abs_work_dir = fs::absolute(work_dir).string();

            std::cout << "▶ 매치 ID: " << match_id << " (제한시간: " << time_limit_sec << "초)" << std::endl;

            // 작업 폴더 생성
            std::error_code ec;
            fs::create_directories(work_dir, ec);
            if (ec) {
                std::cerr << "폴더 생성 실패: " << ec.message() << std::endl;
                continue;
            }

            // C++ 코드 생성
            write_file(work_dir + "/judge.cpp", data["codes"]["judge"]);
            write_file(work_dir + "/player1.cpp", data["codes"]["player1"]);
            write_file(work_dir + "/player2.cpp", data["codes"]["player2"]);

            json result_json;
            result_json["matchId"] = match_id;

            // Dockerfile 생성 및 build 제거 -> 볼륨 마운트로 즉시 컴파일
            std::cout << "빌드 중..." << std::endl;
            std::string compile_cmd = "docker run --rm -v " + abs_work_dir + ":/app -w /app gcc:latest " +
                                      "sh -c \"g++ -O2 -o judge judge.cpp && g++ -O2 -o player1 player1.cpp && g++ -O2 -o player2 player2.cpp && chmod 777 judge player1 player2\" 2>&1";
            
            CmdResult build_res = exec_cmd(compile_cmd);
            if (build_res.exit_code != 0) {
                result_json["status"] = "COMPILE_ERROR";
                result_json["log"] = build_res.output;
                redis.lpush("code_battle_result_queue", result_json.dump());
                fs::remove_all(work_dir, ec);
                continue;
            }

            std::cout << "실행 및 채점 중..." << std::endl;
            std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                  "docker run -i --rm -v " + abs_work_dir + ":/app -w /app " +
                                  "--memory=512m --network=none gcc:latest " +
                                  "./judge ./player1 ./player2 2>&1";
            
            CmdResult run_res = exec_cmd(run_cmd);
            result_json["log"] = run_res.output;

            // 결과 판정
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

            redis.lpush("code_battle_result_queue", result_json.dump());

            // 이미지 및 임시 폴더 삭제
            fs::remove_all(work_dir, ec);
            
            std::cout << "▶ 매치 처리 완료. 다음 대결을 대기합니다." << std::endl;
        }
    } catch (const Error &e) {
        std::cerr << "Redis 에러 발생: " << e.what() << std::endl;
    }

    return 0;
}