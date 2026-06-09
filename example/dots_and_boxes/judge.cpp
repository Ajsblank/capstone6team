#include <iostream>
#include <sstream>
#include <chrono>
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

int hlines[NR+1][NC]; // hlines[r][c]: r행 c~c+1 사이 수평 선분
int vlines[NR][NC+1]; // vlines[r][c]: r~r+1행 c열 사이 수직 선분
int boxes[NR][NC];    // 박스 소유자

int totalLines()  { return (NR+1)*NC + NR*(NC+1); }
int placedLines() {
    int n = 0;
    for (int r=0;r<=NR;r++) for (int c=0;c<NC;c++) if (hlines[r][c]) n++;
    for (int r=0;r<NR;r++) for (int c=0;c<=NC;c++) if (vlines[r][c]) n++;
    return n;
}

// 선분 배치 후 박스 완성 여부 반환
int placeAndCheck(bool isHoriz, int r1, int c1, int pNum) {
    if (isHoriz) hlines[r1][c1] = pNum;
    else          vlines[r1][c1] = pNum;

    int made = 0;
    auto checkBox = [&](int br, int bc) {
        if (br < 0 || br >= NR || bc < 0 || bc >= NC) return;
        if (boxes[br][bc]) return;
        if (hlines[br][bc] && hlines[br+1][bc] &&
            vlines[br][bc] && vlines[br][bc+1]) {
            boxes[br][bc] = pNum;
            made++;
        }
    };
    if (isHoriz) { checkBox(r1-1, c1); checkBox(r1, c1); }
    else         { checkBox(r1, c1-1); checkBox(r1, c1); }
    return made;
}

int countBoxes(int pNum) {
    int n = 0;
    for (int r=0;r<NR;r++) for (int c=0;c<NC;c++) if (boxes[r][c]==pNum) n++;
    return n;
}

void probeOpponent(Player& opp, Player& cur, int& dummy) {
    send_msg(opp, "TIME 0 0");
    string resp = recv_msg(opp, 1000, dummy);
    int r1,c1,r2,c2;
    istringstream ss(resp);
    if (resp == "TIMEOUT" || !(ss >> r1 >> c1 >> r2 >> c2))
        opp.result = cur.result; // 같은 에러
}

int main(int argc, char* argv[]) {
    signal(SIGPIPE, SIG_IGN);
    if (argc != 3) {
        cerr << "사용법: ./judge <player1> <player2>\n";
        return 1;
    }

    memset(hlines, 0, sizeof(hlines));
    memset(vlines, 0, sizeof(vlines));
    memset(boxes,  0, sizeof(boxes));

    const int TOTAL_TIME_MS = 10000;
    const int READY_TIMEOUT_MS = 3000;

    Player p1 = start_player("FIRST",  argv[1], TOTAL_TIME_MS);
    Player p2 = start_player("SECOND", argv[2], TOTAL_TIME_MS);
    Player* players[2] = {&p1, &p2};

    send_msg(p1, "READY FIRST");
    send_msg(p2, "READY SECOND");

    int dummy;
    if (recv_msg(p1, READY_TIMEOUT_MS, dummy) != "OK") {
        p1.result = ERROR;
        if (recv_msg(p2, READY_TIMEOUT_MS, dummy) != "OK") p2.result = ERROR;
        cout << "INIT " << NR << " " << NC << "\n";
        cout << resultStr(p1.result) << " " << resultStr(p2.result) << "\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }
    if (recv_msg(p2, READY_TIMEOUT_MS, dummy) != "OK") {
        p2.result = ERROR;
        cout << "INIT " << NR << " " << NC << "\n";
        cout << resultStr(p1.result) << " " << resultStr(p2.result) << "\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }

    string initMsg = "INIT " + to_string(NR) + " " + to_string(NC);
    send_msg(p1, initMsg);
    send_msg(p2, initMsg);
    cout << initMsg << "\n";

    int turn = 0;

    while (placedLines() < totalLines()) {
        Player& cur = *players[turn];
        Player& opp = *players[1-turn];
        int pNum = turn + 1;
        string tag = (turn == 0) ? "FIRST" : "SECOND";

        send_msg(cur, "TIME " + to_string(cur.time_left_ms) + " " + to_string(opp.time_left_ms));

        int elapsed = 0;
        string resp = recv_msg(cur, cur.time_left_ms + 500, elapsed);
        cur.time_left_ms -= max(0, elapsed);

        if (resp == "TIMEOUT" || cur.time_left_ms < 0) {
            cur.result = TIME_LIMIT;
            probeOpponent(opp, cur, dummy);
            break;
        }

        int r1, c1, r2, c2;
        istringstream ss(resp);
        if (!(ss >> r1 >> c1 >> r2 >> c2)) {
            cur.result = ERROR;
            probeOpponent(opp, cur, dummy);
            break;
        }

        // 유효성 검사
        bool isHoriz = (r1 == r2 && c2 == c1+1 && r1 >= 0 && r1 <= NR && c1 >= 0 && c1 < NC);
        bool isVert  = (c1 == c2 && r2 == r1+1 && r1 >= 0 && r1 < NR && c1 >= 0 && c1 <= NC);
        bool alreadyPlaced = isHoriz ? hlines[r1][c1] : (isVert ? vlines[r1][c1] : false);

        if ((!isHoriz && !isVert) || alreadyPlaced) {
            cur.result = ERROR;
            probeOpponent(opp, cur, dummy);
            break;
        }

        int made = placeAndCheck(isHoriz, r1, c1, pNum);
        cout << tag << " " << r1 << " " << c1 << " " << r2 << " " << c2 << "\n";
        send_msg(opp, "OPP " + to_string(r1) + " " + to_string(c1) + " " +
                       to_string(r2) + " " + to_string(c2) + " " + to_string(elapsed));

        // 박스 완성 시 같은 플레이어가 한 번 더 (turn 변경 안 함)
        if (made == 0) turn = 1 - turn;
    }

    send_msg(p1, "FINISH");
    send_msg(p2, "FINISH");
    usleep(300000);
    terminate_player(p1);
    terminate_player(p2);

    if (p1.result == WIN && p2.result == WIN) {
        int b1 = countBoxes(1), b2 = countBoxes(2);
        if      (b1 > b2) { p2.result = LOSE; }
        else if (b2 > b1) { p1.result = LOSE; }
        else              { p1.result = NONE; p2.result = NONE; }
    }

    cout << resultStr(p1.result) << " " << resultStr(p2.result) << "\n";
    return 0;
}
