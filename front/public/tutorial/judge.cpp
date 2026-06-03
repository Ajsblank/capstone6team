#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <chrono>
#include <random>
#include <unistd.h>
#include <sys/wait.h>
#include <poll.h>

using namespace std;

enum Result
{
    NONE, WIN, LOSE, TIME_LIMIT, MEMORY_LIMIT, ERROR
};
Result p1Result = WIN, p2Result = WIN;

const int ROWS = 10;
const int COLS = 17;
const int TOTAL_TIME_MS = 10000;
const int READY_TIMEOUT_MS = 3000;

// ============================================================
// ========= [입출력을 위한 enum <-> string 변환 함수 ]==========
// ============================================================
string EnumToString(Result result)
{
    switch(result)
    {
        case NONE: return "NONE";
        case WIN: return "WIN";
        case LOSE: return "LOSE";
        case TIME_LIMIT: return "TIME_LIMIT";
        case MEMORY_LIMIT: return "MEMORY_LIMIT";
        case ERROR: return "ERROR";
    }
    throw invalid_argument("Invalid Result : " + result);
}

// 플레이어 봇 정보를 담는 구조체
struct Player {
    string name;
    int pid;
    int write_fd;  // 채점기가 봇의 stdin으로 보낼 파이프
    int read_fd;   // 채점기가 봇의 stdout에서 읽을 파이프
    int time_left_ms;
    Result result;
};

// 봇 서브프로세스 실행 함수
Player start_player(string name, string cmd) {
    int p_in[2], p_out[2];
    if (pipe(p_in) == -1 || pipe(p_out) == -1) {
        cerr << "Pipe creation failed" << "\n";
        exit(1);
    }

    int pid = fork();
    if (pid == -1) {
        cerr << "Fork failed" << "\n";
        exit(1);
    }

    if (pid == 0) { // 자식 프로세스 (봇)
        dup2(p_in[0], STDIN_FILENO);
        dup2(p_out[1], STDOUT_FILENO);
        close(p_in[0]); close(p_in[1]);
        close(p_out[0]); close(p_out[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        exit(1); // execl 실패 시 종료
    }

    // 부모 프로세스 (채점기)
    close(p_in[0]);
    close(p_out[1]);
    return {name, pid, p_in[1], p_out[0], TOTAL_TIME_MS, WIN};
}

// 봇에게 메시지 전송
void send_msg(Player& p, string msg) {
    msg += "\n";
    write(p.write_fd, msg.c_str(), msg.size());
}

// 봇으로부터 제한 시간 내에 응답 받기
string recv_msg(Player& p, int timeout_ms, int& actual_time_ms) {
    auto start = chrono::steady_clock::now();
    string res = "";
    char c;
    struct pollfd pfd;
    pfd.fd = p.read_fd;
    pfd.events = POLLIN;

    while (true) {
        auto now = chrono::steady_clock::now();
        int elapsed = chrono::duration_cast<chrono::milliseconds>(now - start).count();
        int remain = timeout_ms - elapsed;
        if (remain <= 0) break; // 시간 초과

        int ret = poll(&pfd, 1, remain);
        if (ret > 0) {
            if (read(p.read_fd, &c, 1) > 0) {
                if (c == '\n') {
                    actual_time_ms = chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - start).count();
                    return res;
                }
                if (c != '\r') res += c;
            } else {
                break; // EOF
            }
        } else if (ret == 0) {
            break; // Timeout
        } else {
            break; // Error
        }
    }
    actual_time_ms = chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - start).count();
    return "TIMEOUT";
}

// 봇 종료
void terminate_player(Player& p) {
    kill(p.pid, SIGKILL);
    waitpid(p.pid, nullptr, 0);
    close(p.write_fd);
    close(p.read_fd);
}

class Game {
public:
    vector<vector<int>> board;
    vector<vector<int>> ownership; // 0: 빈칸, 1: 선공(FIRST), 2: 후공(SECOND)

    Game() {
        board.assign(ROWS, vector<int>(COLS, 0));
        ownership.assign(ROWS, vector<int>(COLS, 0));
        random_device rd;
        mt19937 gen(rd());
        uniform_int_distribution<int> dis(1, 9);
        for (int r = 0; r < ROWS; r++)
            for (int c = 0; c < COLS; c++)
                board[r][c] = dis(gen);
    }

    string get_init_string() {
        string s = "INIT ";
        for (int r = 0; r < ROWS; r++) {
            for (int c = 0; c < COLS; c++) {
                s += to_string(board[r][c]);
            }
            if (r != ROWS - 1) s += " ";
        }
        return s;
    }

    bool is_valid_move(int r1, int c1, int r2, int c2) {
        if (!(0 <= r1 && r1 <= r2 && r2 < ROWS && 0 <= c1 && c1 <= c2 && c2 < COLS)) return false;
        
        int sums = 0;
        bool r1_fit = false, r2_fit = false, c1_fit = false, c2_fit = false;

        for (int r = r1; r <= r2; r++) {
            for (int c = c1; c <= c2; c++) {
                if (board[r][c] > 0) {
                    sums += board[r][c];
                    if (r == r1) r1_fit = true;
                    if (r == r2) r2_fit = true;
                    if (c == c1) c1_fit = true;
                    if (c == c2) c2_fit = true;
                }
            }
        }
        return (sums == 10) && r1_fit && r2_fit && c1_fit && c2_fit;
    }

    void apply_move(int r1, int c1, int r2, int c2, int player_id) {
        for (int r = r1; r <= r2; r++) {
            for (int c = c1; c <= c2; c++) {
                board[r][c] = 0;
                ownership[r][c] = player_id;
            }
        }
    }
};

int main(int argc, char* argv[]) {
    if (argc != 3) {
        cerr << "사용법: ./judge <Player1_code> <Player2_code>" << "\n";
        return 1;
    }

    Player p1 = start_player("FIRST", argv[1]);
    Player p2 = start_player("SECOND", argv[2]);
    Player* players[2] = {&p1, &p2};

    Game game;

    // READY 전송
    send_msg(p1, "READY FIRST");
    send_msg(p2, "READY SECOND");

    int dummy_time;
    if (recv_msg(p1, READY_TIMEOUT_MS, dummy_time) != "OK") {
        p1Result = ERROR;
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << "\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }
    if (recv_msg(p2, READY_TIMEOUT_MS, dummy_time) != "OK") {
        p2Result = ERROR;
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << "\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }

    // INIT 전송
    string init_str = game.get_init_string();
    send_msg(p1, init_str);
    send_msg(p2, init_str);
    cout << init_str << "\n";

    int turn = 0;
    int consecutive_passes = 0;

    while (true) {
        Player& cur_p = *players[turn];
        Player& opp_p = *players[1 - turn];
        int player_id = turn + 1;

        // TIME 전송
        send_msg(cur_p, "TIME " + to_string(cur_p.time_left_ms) + " " + to_string(opp_p.time_left_ms));

        int actual_time_ms = 0;
        // 여유 시간 500ms 부여하여 타임아웃 검사
        string resp = recv_msg(cur_p, cur_p.time_left_ms + 500, actual_time_ms);
        
        cur_p.time_left_ms -= max(0, actual_time_ms);

        if (resp == "TIMEOUT" || cur_p.time_left_ms < 0) {
            cur_p.result = TIME_LIMIT;
            break;
        }

        int r1, c1, r2, c2;
        stringstream ss(resp);
        if (!(ss >> r1 >> c1 >> r2 >> c2)) {
            cur_p.result = ERROR;
            break;
        }

        if (r1 == -1 && c1 == -1 && r2 == -1 && c2 == -1) {
            consecutive_passes++;
        } else {
            consecutive_passes = 0;
            if (!game.is_valid_move(r1, c1, r2, c2)) {
                cur_p.result = ERROR;
                break;
            }
            game.apply_move(r1, c1, r2, c2, player_id);
        }

        // 상대에게 OPP 전송
        send_msg(opp_p, "OPP " + to_string(r1) + " " + to_string(c1) + " " + to_string(r2) + " " + to_string(c2) + " " + to_string(max(0, actual_time_ms)));
        cout << (!turn?"FIRST ":"SECOND ") << r1 << " " << c1 << " " << r2 << " " << c2 << " " << actual_time_ms << "\n";
        if (consecutive_passes == 2) {
            break;
        }

        turn = 1 - turn;
    }

    send_msg(p1, "FINISH");
    send_msg(p2, "FINISH");

    usleep(500000);
    terminate_player(p1);
    terminate_player(p2);

    if(players[0]->result == WIN && players[1]->result == WIN)
    {
        int a = 0, b = 0;
        for(int i = 0; i < ROWS; i++)
            for(int j = 0; j < COLS; j++)
            {
                if(game.ownership[i][j] == 1)
                    a++;
                else if(game.ownership[i][j] == 2)
                    b++;
            }
        if(a<b)
            players[0]->result = LOSE;
        if(a>b)
            players[1]->result = LOSE;
    }
    
    cout << EnumToString(players[0]->result) << " " << EnumToString(players[1]->result) << "\n";
    return 0;
}