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

int setup_role(const std::string& role, const std::string& code, const std::string& lang, const std::string& abs_work_dir) {
    std::string file_name = role;
    std::string compile_cmd = "";
    std::string run_cmd = "";
    std::string docker_img = "code-battle-env"; // 다중 언어 지원 이미지 이름

    if (lang == "java") {
        file_name[0] = std::toupper(file_name[0]); // player1 -> Player1
        write_file(abs_work_dir + "/" + file_name + ".java", code);
        compile_cmd = "docker run --rm -v " + abs_work_dir + ":/app -w /app " + docker_img + " javac " + file_name + ".java";
        run_cmd = "java -cp /app " + file_name;
    } else if (lang == "python" || lang == "py") {
        write_file(abs_work_dir + "/" + role + ".py", code);
        // 파이썬은 사전 컴파일이 필요 없음
        run_cmd = "python3 /app/" + role + ".py";
    } else { // 기본값 C++
        write_file(abs_work_dir + "/" + role + ".cpp", code);
        compile_cmd = "docker run --rm -v " + abs_work_dir + ":/app -w /app " + docker_img + " g++ -O2 -o " + role + " " + role + ".cpp";
    }

    // 컴파일이 필요한 언어(C++, Java)의 경우 컴파일 수행
    if (!compile_cmd.empty()) {
        CmdResult res = exec_cmd(compile_cmd);
        if (res.exit_code != 0) {
            std::cerr << "[" << role << " 컴파일 에러]\n" << res.output << std::endl;
            return res.exit_code;
        }
    }

    // JVM이나 인터프리터를 거쳐야 하는 경우, Judge가 실행 파일처럼 호출할 수 있도록 Wrapper 생성
    if (!run_cmd.empty()) {
        std::string wrapper_path = abs_work_dir + "/" + role;
        write_file(wrapper_path, "#!/bin/sh\n" + run_cmd + " \"$@\"\n");
        // 생성된 스크립트에 실행 권한 부여
        fs::permissions(wrapper_path, fs::perms::owner_all | fs::perms::group_exec | fs::perms::others_exec);
    }

    return 0;
}

int main() {
    try {
        std::cout << "[Worker] 채점 환경(Docker) 초기화 중..." << std::endl;
        
        std::string dockerfile_content =
            "FROM ubuntu:22.04\n"
            "ENV DEBIAN_FRONTEND=noninteractive\n"
            "RUN apt-get update && apt-get install -y \\\n"
            "    build-essential \\\n"
            "    openjdk-17-jdk \\\n"
            "    python3 \\\n"
            "    && rm -rf /var/lib/apt/lists/*\n"
            "CMD [\"/bin/bash\"]\n";
            
        write_file("./Dockerfile", dockerfile_content);

        CmdResult build_res = exec_cmd("docker build -t code-battle-env .");
        if (build_res.exit_code != 0) {
            std::cerr << "[에러] Docker 통합 이미지 빌드 실패:\n" << build_res.output << std::endl;
            return 1; // 필수 환경 구성 실패 시 서버 종료
        }
        std::cout << "[Worker] 다국어 채점 환경(code-battle-env) 준비 완료!\n";

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
                
                int time_limit_sec = 1000;
                std::string work_dir = "./";
                std::string abs_work_dir = fs::absolute(work_dir).string();

                std::cout << "▶ 테스트 매치: " << " (제한시간: " << time_limit_sec << "초)" << std::endl;

                // 작업 폴더 생성
                std::error_code ec;
                fs::create_directories(work_dir, ec);
                if (ec) {
                    std::cerr << "폴더 생성 실패: " << ec.message() << std::endl;
                    continue;
                }

                // 언어 정보 파싱 (기본값 cpp)
                std::string j_lang = data.contains("languages") ? data["languages"].value("judge", "cpp") : "cpp";
                std::string p1_lang = data.contains("languages") ? data["languages"].value("player1", "cpp") : "cpp";
                std::string p2_lang = data.contains("languages") ? data["languages"].value("player2", "cpp") : "cpp";

                json result_json;
                result_json["userId"] = data["userId"];
                result_json["log"] = "error";

                // Dockerfile 생성 및 build 제거 -> 볼륨 마운트로 즉시 컴파일
                std::cout << "빌드 중..." << std::endl;
                int exit_j = setup_role("judge", data["judge"], j_lang, abs_work_dir);
                int exit_p1 = setup_role("player1", data["player1"], p1_lang, abs_work_dir);
                int exit_p2 = setup_role("player2", data["player2"], p2_lang, abs_work_dir);
                
                if (exit_j != 0) {
                    result_json["log"] = "Judge Compile Error";
                } else if (exit_p1 != 0 && exit_p2 != 0) {
                    result_json["log"] = "Both Players Compile Error";
                } else if (exit_p1 != 0) {
                    result_json["log"] = "Player 1 Compile Error";
                } else if (exit_p2 != 0) {
                    result_json["log"] = "Player 2 Compile Error";
                }
                else
                {
                    std::cout << "실행 및 채점 중..." << std::endl;
                    std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                        "docker run -i --rm -v " + abs_work_dir + ":/app -w /app " +
                                        "--memory=512m --network=none code-battle-env " +
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
                
                //int time_limit_sec = data["timeLimitSec"];
                int time_limit_sec = 1000;
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
                std::string j_lang = data.contains("languages") ? data["languages"].value("judge", "cpp") : "cpp";
                std::string p1_lang = data.contains("languages") ? data["languages"].value("player1", "cpp") : "cpp";
                std::string p2_lang = data.contains("languages") ? data["languages"].value("player2", "cpp") : "cpp";
    
                json result_json;
                result_json["matchId"] = match_id_num;
                result_json["winner"] = 0;
                result_json["log"] = "";
                //result_json["player1Result"] = "ERROR";
                //result_json["player2Result"] = "ERROR";
    
                // Dockerfile 생성 및 build 제거 -> 볼륨 마운트로 즉시 컴파일
                std::cout << "빌드 중..." << std::endl;
                int exit_j = setup_role("judge", data["codes"]["judge"], j_lang, abs_work_dir);
                int exit_p1 = setup_role("player1", data["codes"]["player1"], p1_lang, abs_work_dir);
                int exit_p2 = setup_role("player2", data["codes"]["player2"], p2_lang, abs_work_dir);
                
                if (exit_j != 0) {
                    result_json["winner"] = 0;
                } else if (exit_p1 != 0 && exit_p2 != 0) {
                    result_json["winner"] = 0;
                } else if (exit_p1 != 0) {
                    result_json["winner"] = 2; // P1 컴파일 에러면 P2 승
                } else if (exit_p2 != 0) {
                    result_json["winner"] = 1; // P2 컴파일 에러면 P1 승
                }
                else
                {
                    std::cout << "실행 및 채점 중..." << std::endl;
                    std::string run_cmd = "timeout " + std::to_string(time_limit_sec) + "s " +
                                        "docker run -i --rm -v " + abs_work_dir + ":/app -w /app " +
                                        "--memory=512m --network=none code-battle-env " +
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