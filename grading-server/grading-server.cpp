#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
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
        auto redis = Redis("tcp://3.216.165.85:6379");
        //auto redis = Redis("tcp://localhost:6379");
        std::cout << "[Worker] 코드 배틀 서버 시작...\n";

        while (true) {
            auto item = redis.brpop({"code_battle_test_queue", "code_battle_grading_queue"}, 0);
            if (!item) continue;
            std::string queue_name = item->first;
            std::string json_str = item->second;
            json data = json::parse(json_str);
            if (queue_name == "code_battle_test_queue") {
                
                int time_limit_sec = 10;
                std::string work_dir = "./";
                std::string abs_work_dir = fs::absolute(work_dir).string();

                std::cout << "▶ 매치 ID: " << " (제한시간: " << time_limit_sec << "초)" << std::endl;

                // 작업 폴더 생성
                std::error_code ec;
                fs::create_directories(work_dir, ec);
                if (ec) {
                    std::cerr << "폴더 생성 실패: " << ec.message() << std::endl;
                    continue;
                }

                // C++ 코드 생성
                write_file(work_dir + "/judge.cpp", data["judge"]);
                write_file(work_dir + "/player1.cpp", data["player1"]);
                write_file(work_dir + "/player2.cpp", data["player2"]);

                json result_json;
                result_json["userId"] = data["userId"];
                result_json["log"] = "error";

                // Dockerfile 생성 및 build 제거 -> 볼륨 마운트로 즉시 컴파일
                std::cout << "빌드 중..." << std::endl;
                auto compile = [&](const std::string& file, const std::string& out) {
                return exec_cmd("docker run --rm -v " + abs_work_dir + ":/app -w /app gcc:latest g++ -O2 -o " + out + " " + file);
                };
                CmdResult res_j = compile("judge.cpp", "judge");
                CmdResult res_p1 = compile("player1.cpp", "player1");
                CmdResult res_p2 = compile("player2.cpp", "player2");
                
                if (res_j.exit_code != 0) {
                } else if (res_p1.exit_code != 0 && res_p2.exit_code != 0) {
                } else if (res_p1.exit_code != 0) {
                } else if (res_p2.exit_code != 0) {
                }
                else
                {
                    std::cout << "실행 및 채점 중..." << std::endl;
                    std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                        "docker run -i --rm -v " + abs_work_dir + ":/app -w /app " +
                                        "--memory=512m --network=none gcc:latest " +
                                        "./judge ./player1 ./player2 2>&1";
                
                    CmdResult run_res = exec_cmd(run_cmd);
                    result_json["log"] = run_res.output;
                }
                redis.lpush("code_battle_test_result_queue", result_json.dump());

                // 이미지 및 임시 폴더 삭제
                fs::remove_all(work_dir, ec);
                
                std::cout << "▶ 매치 처리 완료. 다음 대결을 대기합니다." << std::endl;
            }
            else if (queue_name == "code_battle_grading_queue") {
    
                long long match_id_num = data["submissionId"];
                std::string match_id = std::to_string(match_id_num);
    
                std::regex valid_id_regex("^[a-zA-Z0-9_-]+$");
                if (!std::regex_match(match_id, valid_id_regex)) {
                    std::cout << "[보안 경고] 유효하지 않은 submissionId : " << match_id << std::endl;
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
                result_json["matchId"] = match_id_num;
                result_json["winner"] = 0;
                result_json["log"] = "";
                //result_json["player1Result"] = "ERROR";
                //result_json["player2Result"] = "ERROR";
    
                // Dockerfile 생성 및 build 제거 -> 볼륨 마운트로 즉시 컴파일
                std::cout << "빌드 중..." << std::endl;
                auto compile = [&](const std::string& file, const std::string& out) {
                return exec_cmd("docker run --rm -v " + abs_work_dir + ":/app -w /app gcc:latest g++ -O2 -o " + out + " " + file);
                };
                CmdResult res_j = compile("judge.cpp", "judge");
                CmdResult res_p1 = compile("player1.cpp", "player1");
                CmdResult res_p2 = compile("player2.cpp", "player2");
                
                if (res_j.exit_code != 0) {
                    result_json["winner"] = 0;
                } else if (res_p1.exit_code != 0 && res_p2.exit_code != 0) {
                    result_json["winner"] = 0;
                } else if (res_p1.exit_code != 0) {
                    result_json["winner"] = 2;
                } else if (res_p2.exit_code != 0) {
                    result_json["winner"] = 1;
                }
                else
                {
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
                        result_json["winner"] = -1;
                    }
                    else {
                        std::string out = run_res.output;
                        out.erase(out.find_last_not_of(" \n\r\t") + 1);
                        size_t last_nl = out.find_last_of("\n");
                        std::string last_line = (last_nl == std::string::npos) ? out : out.substr(last_nl + 1);
                        
                        std::string p1_str, p2_str;
                        std::stringstream ss(last_line);
                        ss >> p1_str >> p2_str;
                    
                        auto parse_enum = [](const std::string& s) {
                            if (s == "0" || s == "NONE") return "NONE";
                            if (s == "1" || s == "WIN") return "WIN";
                            if (s == "2" || s == "LOSE") return "LOSE";
                            if (s == "3" || s == "TIME_LIMIT") return "TIME_LIMIT";
                            if (s == "4" || s == "MEMORY_LIMIT") return "MEMORY_LIMIT";
                            if (s == "5" || s == "ERROR") return "ERROR";
                            return "ERROR";
                        };
                    
                        std::string p1_result = parse_enum(p1_str);
                        std::string p2_result = parse_enum(p2_str);
                    
                        //result_json["player1Result"] = p1_result;
                        //result_json["player2Result"] = p2_result;
                    
                        if(p1_result == p2_result)
                            result_json["winner"] = 0;
                        else if (p1_result == "WIN") result_json["winner"] = 1;
                        else if (p2_result == "WIN") result_json["winner"] = 2;
                        else result_json["winner"] = 0;
                    
                        if (run_res.exit_code == 0) {
                            std::cout << "[결과] ✅ 정상 종료! (P1: " << p1_result << ", P2: " << p2_result << ")" << std::endl;
                        }
                        else {
                            std::cout << "[결과] ⚠️ 런타임 에러 (Exit Code: " << run_res.exit_code << ")" << std::endl;
                            result_json["status"] = "RUNTIME_ERROR";
                        }
                    }
                }
                if(data["aiOrder"] == 0)
                    redis.lpush("code_battle_result_queue", result_json.dump());
                else
                {
                    result_json["aiOrder"] = data["aiOrder"];
                    redis.lpush("code_battle_ai_result_queue", result_json.dump());
                }
    
                // 이미지 및 임시 폴더 삭제
                fs::remove_all(work_dir, ec);
                
                std::cout << "▶ 매치 처리 완료. 다음 대결을 대기합니다." << std::endl;
            }
        }
    } catch (const Error &e) {
        std::cerr << "Redis 에러 발생: " << e.what() << std::endl;
    }

    return 0;
}