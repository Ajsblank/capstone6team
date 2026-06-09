#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <queue>
#include <chrono>
#include <random>
#include <unistd.h>
#include <sys/wait.h>
#include <poll.h>
#include <csignal>

using namespace std;

enum Result {
    NONE, WIN, LOSE, TIME_LIMIT, MEMORY_LIMIT, ERROR
};
Result p1Result = WIN, p2Result = WIN;

const int NR = 10;
const int NC = 10;
const int NUM_COLORS = 6;
const int TOTAL_TIME_MS = 10000;
const int READY_TIMEOUT_MS = 3000;
const int MAX_TURNS_EACH = 30; // 안전장치: 플레이어당 최대 30턴

string EnumToString(Result result) {
    switch (result) {
        case NONE:         return "NONE";
        case WIN:          return "WIN";
        case LOSE:         return "LOSE";
        case TIME_LIMIT:   return "TIME_LIMIT";
        case MEMORY_LIMIT: return "MEMORY_LIMIT";
        case ERROR:        return "ERROR";
    }
    throw invalid_argument("Invalid Result");
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
        cerr << "Pipe creation failed\n";
        exit(1);
    }

    int pid = fork();
    if (pid == -1) {
        cerr << "Fork failed\n";
        exit(1);
    }

    if (pid == 0) { // 자식 프로세스 (봇)
        dup2(p_in[0], STDIN_FILENO);
        dup2(p_out[1], STDOUT_FILENO);
        close(p_in[0]); close(p_in[1]);
        close(p_out[0]); close(p_out[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        exit(1);
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
        if (remain <= 0) break;

        int ret = poll(&pfd, 1, remain);
        if (ret > 0) {
            if (read(p.read_fd, &c, 1) > 0) {
                if (c == '\n') {
                    actual_time_ms = chrono::duration_cast<chrono::milliseconds>(
                        chrono::steady_clock::now() - start).count();
                    return res;
                }
                if (c != '\r') res += c;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    actual_time_ms = chrono::duration_cast<chrono::milliseconds>(
        chrono::steady_clock::now() - start).count();
    return "TIMEOUT";
}

// 봇 종료
void terminate_player(Player& p) {
    kill(p.pid, SIGKILL);
    waitpid(p.pid, nullptr, 0);
    close(p.write_fd);
    close(p.read_fd);
}

// 보드 칸 구조체
struct Cell {
    int color; // 1~6
    int owner; // 0=중립, 1=선공, 2=후공
};

// 게임 상태
struct Game {
    Cell grid[NR][NC];

    Game() {
        random_device rd;
        mt19937 gen(rd());
        uniform_int_distribution<int> dis(1, NUM_COLORS);

        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++) {
                grid[r][c].color = dis(gen);
                grid[r][c].owner = 0;
            }

        // 선공: (0,0), 후공: (9,9)
        grid[0][0].owner = 1;
        grid[NR-1][NC-1].owner = 2;

        // 두 코너 색상이 같으면 후공 코너 재랜덤
        while (grid[NR-1][NC-1].color == grid[0][0].color)
            grid[NR-1][NC-1].color = dis(gen);
    }

    // INIT 문자열 생성: "INIT r0 r1 ... r9"
    string get_init_string() const {
        string s = "INIT";
        for (int r = 0; r < NR; r++) {
            s += ' ';
            for (int c = 0; c < NC; c++)
                s += ('0' + grid[r][c].color);
        }
        return s;
    }

    // 중립 칸 개수 반환
    int count_neutral() const {
        int n = 0;
        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (grid[r][c].owner == 0) n++;
        return n;
    }

    // 플레이어의 칸 개수 반환
    int count_owned(int pNum) const {
        int n = 0;
        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (grid[r][c].owner == pNum) n++;
        return n;
    }

    // expand: pNum 플레이어가 chosenColor를 선택했을 때 보드 갱신
    // 반환값: 새로 흡수한 칸 수 (유효성 검사용)
    int expand(int pNum, int chosenColor) {
        // 1단계: 해당 플레이어의 모든 칸 색상을 chosenColor로 변경
        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (grid[r][c].owner == pNum)
                    grid[r][c].color = chosenColor;

        // 2단계: BFS로 인접 중립 칸 중 chosenColor인 칸 흡수
        queue<pair<int,int>> q;
        vector<vector<bool>> visited(NR, vector<bool>(NC, false));

        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (grid[r][c].owner == pNum) {
                    visited[r][c] = true;
                    q.push({r, c});
                }

        const int dr[] = {-1, 1, 0, 0};
        const int dc[] = {0, 0, -1, 1};
        int absorbed = 0;

        while (!q.empty()) {
            auto [r, c] = q.front(); q.pop();
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= NR || nc < 0 || nc >= NC) continue;
                if (visited[nr][nc]) continue;
                if (grid[nr][nc].owner != 0) continue;
                if (grid[nr][nc].color != chosenColor) continue;
                visited[nr][nc] = true;
                grid[nr][nc].owner = pNum;
                absorbed++;
                q.push({nr, nc});
            }
        }
        return absorbed;
    }
};

int main(int argc, char* argv[]) {
    signal(SIGPIPE, SIG_IGN);

    if (argc != 3) {
        cerr << "사용법: ./judge <Player1_cmd> <Player2_cmd>\n";
        return 1;
    }

    Player p1 = start_player("FIRST",  argv[1]);
    Player p2 = start_player("SECOND", argv[2]);
    Player* players[2] = {&p1, &p2};

    Game game;

    // READY 전송
    send_msg(p1, "READY FIRST");
    send_msg(p2, "READY SECOND");

    int dummy_time;
    if (recv_msg(p1, READY_TIMEOUT_MS, dummy_time) != "OK") {
        p1Result = ERROR;
        recv_msg(p2, READY_TIMEOUT_MS, dummy_time); // p2도 drain
        p2Result = ERROR;
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << "\n";
        terminate_player(p1); terminate_player(p2);
        return 0;
    }
    if (recv_msg(p2, READY_TIMEOUT_MS, dummy_time) != "OK") {
        p2Result = ERROR;
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << "\n";
        terminate_player(p1); terminate_player(p2);
        return 0;
    }

    // INIT 전송 및 로그 출력
    string init_str = game.get_init_string();
    send_msg(p1, init_str);
    send_msg(p2, init_str);
    cout << init_str << "\n";
    cout.flush();

    // 게임 루프: 선공(0), 후공(1) 번갈아
    int turn = 0;           // 0 = 선공(p1), 1 = 후공(p2)
    int turns_each[2] = {0, 0};
    bool game_over = false;

    while (!game_over) {
        Player& cur_p = *players[turn];
        Player& opp_p = *players[1 - turn];
        int pNum = turn + 1; // 1 또는 2
        const string pTag = (turn == 0) ? "FIRST" : "SECOND";

        // 안전장치: 최대 턴 초과
        if (turns_each[turn] >= MAX_TURNS_EACH)
            break;

        // TIME 전송
        send_msg(cur_p,
            "TIME " + to_string(cur_p.time_left_ms) +
            " "     + to_string(opp_p.time_left_ms));

        int actual_time_ms = 0;
        string resp = recv_msg(cur_p, cur_p.time_left_ms + 500, actual_time_ms);
        cur_p.time_left_ms -= max(0, actual_time_ms);

        if (resp == "TIMEOUT" || cur_p.time_left_ms < 0) {
            cur_p.result = TIME_LIMIT;
            game_over = true;
            break;
        }

        // 응답 파싱: 색상 정수 1~6
        int chosenColor = -1;
        {
            istringstream ss(resp);
            if (!(ss >> chosenColor)) {
                cur_p.result = ERROR;
                game_over = true;
                break;
            }
        }

        // 유효성 검사
        if (chosenColor < 1 || chosenColor > NUM_COLORS) {
            cur_p.result = ERROR;
            game_over = true;
            break;
        }

        // expand 적용
        game.expand(pNum, chosenColor);
        turns_each[turn]++;

        // 로그 출력
        cout << pTag << " " << chosenColor << "\n";
        cout.flush();

        // 상대에게 OPP 전송
        send_msg(opp_p,
            "OPP " + to_string(chosenColor) +
            " "    + to_string(max(0, actual_time_ms)));

        // 중립 칸이 없으면 종료
        if (game.count_neutral() == 0) {
            game_over = true;
            break;
        }

        // 턴 교대
        turn = 1 - turn;
    }

    // FINISH 전송
    send_msg(p1, "FINISH");
    send_msg(p2, "FINISH");

    usleep(500000);
    terminate_player(p1);
    terminate_player(p2);

    // 최종 결과 판정
    if (p1.result == WIN && p2.result == WIN) {
        int s1 = game.count_owned(1);
        int s2 = game.count_owned(2);
        if      (s1 > s2) { p2.result = LOSE; }
        else if (s2 > s1) { p1.result = LOSE; }
        else               { p1.result = NONE; p2.result = NONE; }
    }

    cout << EnumToString(p1.result) << " " << EnumToString(p2.result) << "\n";
    cout.flush();
    return 0;
}
