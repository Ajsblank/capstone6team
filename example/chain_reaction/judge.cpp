#include <iostream>
#include <sstream>
#include <chrono>
#include <cstdlib>
#include <ctime>
#include <cstring>
#include <csignal>
#include <unistd.h>
#include <sys/wait.h>
#include <poll.h>
using namespace std;

enum Result { NONE, WIN, LOSE, TIME_LIMIT, MEMORY_LIMIT, ERROR };

string resultStr(Result r) {
    switch(r) {
        case WIN:          return "WIN";
        case LOSE:         return "LOSE";
        case TIME_LIMIT:   return "TIME_LIMIT";
        case MEMORY_LIMIT: return "MEMORY_LIMIT";
        case ERROR:        return "ERROR";
        default:           return "NONE";
    }
}

struct Player {
    string name;
    int pid, write_fd, read_fd, time_left_ms;
    Result result;
};

Player start_player(const string& name, const string& cmd, int totalMs) {
    int p_in[2], p_out[2];
    pipe(p_in); pipe(p_out);
    int pid = fork();
    if (pid == 0) {
        dup2(p_in[0],  STDIN_FILENO);
        dup2(p_out[1], STDOUT_FILENO);
        close(p_in[0]); close(p_in[1]);
        close(p_out[0]); close(p_out[1]);
        execl("/bin/sh","sh","-c",cmd.c_str(),nullptr);
        exit(1);
    }
    close(p_in[0]); close(p_out[1]);
    return {name, pid, p_in[1], p_out[0], totalMs, WIN};
}

void send_msg(Player& p, const string& msg) {
    string s = msg + "\n";
    write(p.write_fd, s.c_str(), s.size());
}

string recv_msg(Player& p, int timeoutMs, int& elapsedMs) {
    auto start = chrono::steady_clock::now();
    string res;
    char c;
    struct pollfd pfd = {p.read_fd, POLLIN, 0};
    while (true) {
        int elapsed = chrono::duration_cast<chrono::milliseconds>(
            chrono::steady_clock::now() - start).count();
        int remain = timeoutMs - elapsed;
        if (remain <= 0) { elapsedMs = elapsed; return "TIMEOUT"; }
        if (poll(&pfd, 1, remain) > 0) {
            if (read(p.read_fd, &c, 1) > 0) {
                if (c == '\n') { elapsedMs = elapsed; return res; }
                if (c != '\r') res += c;
            } else break;
        } else break;
    }
    elapsedMs = chrono::duration_cast<chrono::milliseconds>(
        chrono::steady_clock::now() - start).count();
    return "TIMEOUT";
}

void terminate_player(Player& p) {
    kill(p.pid, SIGKILL);
    waitpid(p.pid, nullptr, 0);
    close(p.write_fd);
    close(p.read_fd);
}

// ── 게임 보드 ─────────────────────────────────────────────
const int NR = 6, NC = 6;
const int MAX_MOVES = 25;

struct Cell { int count; int owner; }; // owner: 0=empty,1=p1,2=p2

int capacity(int r, int c) {
    return 4 - (r==0||r==NR-1 ? 1 : 0) - (c==0||c==NC-1 ? 1 : 0);
}

void processExplosions(Cell board[NR][NC], int pNum) {
    bool changed = true;
    int iter = 0;
    while (changed && iter++ < 500) {
        changed = false;
        for (int r = 0; r < NR; r++) {
            for (int c = 0; c < NC; c++) {
                int cap = capacity(r, c);
                if (board[r][c].count >= cap) {
                    changed = true;
                    board[r][c].count -= cap;
                    if (board[r][c].count == 0) board[r][c].owner = 0;
                    int dr[] = {-1,1,0,0}, dc[] = {0,0,-1,1};
                    for (int d = 0; d < 4; d++) {
                        int nr = r+dr[d], nc = c+dc[d];
                        if (nr<0||nr>=NR||nc<0||nc>=NC) continue;
                        board[nr][nc].count++;
                        board[nr][nc].owner = pNum;
                    }
                }
            }
        }
    }
}

bool opponentHasOrbs(Cell board[NR][NC], int pNum) {
    int opp = (pNum == 1) ? 2 : 1;
    for (int r = 0; r < NR; r++)
        for (int c = 0; c < NC; c++)
            if (board[r][c].owner == opp) return true;
    return false;
}

int totalOrbs(Cell board[NR][NC], int pNum) {
    int n = 0;
    for (int r = 0; r < NR; r++)
        for (int c = 0; c < NC; c++)
            if (board[r][c].owner == pNum) n += board[r][c].count;
    return n;
}

string boardToInitStr(Cell board[NR][NC]) {
    string s = "INIT";
    for (int r = 0; r < NR; r++) {
        s += " ";
        for (int c = 0; c < NC; c++) {
            if (board[r][c].owner == 0) s += '0';
            else if (board[r][c].owner == 1) s += (char)('0' + board[r][c].count);
            else s += (char)('3' + board[r][c].count); // 4,5,6 for p2
        }
    }
    return s;
}

int main(int argc, char* argv[]) {
    signal(SIGPIPE, SIG_IGN);
    if (argc != 3) {
        cerr << "사용법: ./judge <player1> <player2>\n";
        return 1;
    }

    srand((unsigned)time(nullptr));
    const int TOTAL_TIME_MS = 10000;
    const int READY_TIMEOUT_MS = 3000;

    Player p1 = start_player("FIRST",  argv[1], TOTAL_TIME_MS);
    Player p2 = start_player("SECOND", argv[2], TOTAL_TIME_MS);
    Player* players[2] = {&p1, &p2};

    // 보드 초기화
    Cell board[NR][NC] = {};
    for (int pn = 1; pn <= 2; pn++) {
        int placed = 0, attempts = 0;
        while (placed < 4 && attempts++ < 1000) {
            int r = rand() % NR, c = rand() % NC;
            if (board[r][c].owner != 0) continue;
            if (1 >= capacity(r, c)) continue;
            board[r][c].owner = pn;
            board[r][c].count = 1;
            placed++;
        }
    }

    // READY 전송
    send_msg(p1, "READY FIRST");
    send_msg(p2, "READY SECOND");

    int dummy;
    if (recv_msg(p1, READY_TIMEOUT_MS, dummy) != "OK") {
        p1.result = ERROR;
        if (recv_msg(p2, READY_TIMEOUT_MS, dummy) != "OK") p2.result = ERROR;
        cout << boardToInitStr(board) << "\n";
        cout << resultStr(p1.result) << " " << resultStr(p2.result) << "\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }
    if (recv_msg(p2, READY_TIMEOUT_MS, dummy) != "OK") {
        p2.result = ERROR;
        cout << boardToInitStr(board) << "\n";
        cout << resultStr(p1.result) << " " << resultStr(p2.result) << "\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }

    // INIT 전송
    string initStr = boardToInitStr(board);
    send_msg(p1, initStr);
    send_msg(p2, initStr);
    cout << initStr << "\n";

    int turn = 0;
    int moves[2] = {0, 0};

    while (true) {
        Player& cur = *players[turn];
        Player& opp = *players[1 - turn];
        int pNum = turn + 1;
        string tag = (turn == 0) ? "FIRST" : "SECOND";

        // TIME 전송
        send_msg(cur, "TIME " + to_string(cur.time_left_ms) + " " + to_string(opp.time_left_ms));

        int elapsed = 0;
        string resp = recv_msg(cur, cur.time_left_ms + 500, elapsed);
        cur.time_left_ms -= max(0, elapsed);

        if (resp == "TIMEOUT" || cur.time_left_ms < 0) {
            cur.result = TIME_LIMIT;
            // 상대방도 체크
            send_msg(opp, "TIME 0 0");
            string oppResp = recv_msg(opp, 1000, dummy);
            int or_, oc;
            istringstream oss(oppResp);
            if (oppResp == "TIMEOUT" || !(oss >> or_ >> oc)) opp.result = TIME_LIMIT;
            break;
        }

        int r, c;
        istringstream ss(resp);
        if (!(ss >> r >> c)) {
            cur.result = ERROR;
            send_msg(opp, "TIME 0 0");
            string oppResp = recv_msg(opp, 1000, dummy);
            int or_, oc;
            istringstream oss(oppResp);
            if (oppResp == "TIMEOUT" || !(oss >> or_ >> oc)) opp.result = ERROR;
            break;
        }

        // 유효성 검사
        if (r < 0 || r >= NR || c < 0 || c >= NC ||
            (board[r][c].owner != 0 && board[r][c].owner != pNum)) {
            cur.result = ERROR;
            send_msg(opp, "TIME 0 0");
            string oppResp = recv_msg(opp, 1000, dummy);
            int or_, oc;
            istringstream oss(oppResp);
            if (oppResp == "TIMEOUT" || !(oss >> or_ >> oc)) opp.result = ERROR;
            break;
        }

        // 구슬 추가 및 폭발 처리
        board[r][c].owner = pNum;
        board[r][c].count++;
        moves[turn]++;

        processExplosions(board, pNum);
        cout << tag << " " << r << " " << c << "\n";

        // 상대에게 OPP 전송
        send_msg(opp, "OPP " + to_string(r) + " " + to_string(c) + " " + to_string(elapsed));

        // 승리 조건 검사
        if (moves[0] >= 1 && moves[1] >= 1 && !opponentHasOrbs(board, pNum)) {
            break; // 현재 플레이어 WIN
        }

        // 턴 제한
        if (moves[turn] >= MAX_MOVES) {
            // 두 플레이어 모두 MAX_MOVES 이상이면 종료
            if (moves[1-turn] >= MAX_MOVES) break;
        }

        turn = 1 - turn;
    }

    send_msg(p1, "FINISH");
    send_msg(p2, "FINISH");
    usleep(300000);
    terminate_player(p1);
    terminate_player(p2);

    // 최종 결과 판정
    if (p1.result != WIN || p2.result != WIN) {
        // 에러/타임아웃 처리됨
    } else {
        // 정상 종료: 구슬 수 비교
        int o1 = totalOrbs(board, 1), o2 = totalOrbs(board, 2);
        if (o1 > o2)      { p2.result = LOSE; }
        else if (o2 > o1) { p1.result = LOSE; }
        else              { p1.result = NONE; p2.result = NONE; }
    }

    cout << resultStr(p1.result) << " " << resultStr(p2.result) << "\n";
    return 0;
}
