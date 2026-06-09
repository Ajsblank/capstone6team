#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <queue>
#include <algorithm>

using namespace std;

const int NR = 10;
const int NC = 10;
const int NUM_COLORS = 6;

// 보드 칸 구조체
struct Cell {
    int color; // 1~6
    int owner; // 0=중립, 1=선공, 2=후공
};

// 게임 상태를 관리하는 클래스
class Game {
private:
    Cell grid[NR][NC];
    int myNum;   // 내 플레이어 번호 (1=선공, 2=후공)
    int oppNum;  // 상대 플레이어 번호

    // BFS로 pNum 플레이어가 chosenColor를 선택했을 때
    // 새로 흡수할 수 있는 중립 칸 집합을 반환 (보드 변경 없음)
    int simulate_expand(Cell sim[NR][NC], int pNum, int chosenColor) const {
        const int dr[] = {-1, 1, 0, 0};
        const int dc[] = {0, 0, -1, 1};

        queue<pair<int,int>> q;
        bool visited[NR][NC] = {};

        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (sim[r][c].owner == pNum) {
                    visited[r][c] = true;
                    q.push({r, c});
                }

        int absorbed = 0;
        while (!q.empty()) {
            auto [r, c] = q.front(); q.pop();
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= NR || nc < 0 || nc >= NC) continue;
                if (visited[nr][nc]) continue;
                if (sim[nr][nc].owner != 0) continue;
                if (sim[nr][nc].color != chosenColor) continue;
                visited[nr][nc] = true;
                absorbed++;
                q.push({nr, nc});
            }
        }
        return absorbed;
    }

public:
    Game() : myNum(0), oppNum(0) {}

    void setPlayerNum(int n) {
        myNum  = n;
        oppNum = (n == 1) ? 2 : 1;
    }

    // 보드 초기화: INIT 명령의 10개 행 문자열로부터
    void initBoard(const vector<string>& rows) {
        for (int r = 0; r < NR && r < (int)rows.size(); r++)
            for (int c = 0; c < NC && c < (int)rows[r].size(); c++) {
                grid[r][c].color = rows[r][c] - '0';
                grid[r][c].owner = 0;
            }
        // 시작 칸 소유권 설정
        grid[0][0].owner = 1;
        grid[NR-1][NC-1].owner = 2;
    }

    // expand 적용: pNum 플레이어가 chosenColor를 선택
    void expand(int pNum, int chosenColor) {
        const int dr[] = {-1, 1, 0, 0};
        const int dc[] = {0, 0, -1, 1};

        // 1단계: 내 모든 칸 색상을 chosenColor로 변경
        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (grid[r][c].owner == pNum)
                    grid[r][c].color = chosenColor;

        // 2단계: BFS로 인접 중립 칸 중 chosenColor인 칸 흡수
        queue<pair<int,int>> q;
        bool visited[NR][NC] = {};

        for (int r = 0; r < NR; r++)
            for (int c = 0; c < NC; c++)
                if (grid[r][c].owner == pNum) {
                    visited[r][c] = true;
                    q.push({r, c});
                }

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
                q.push({nr, nc});
            }
        }
    }

    // 내 행동 적용
    void applyMyMove(int chosenColor) {
        expand(myNum, chosenColor);
    }

    // 상대 행동 적용
    void applyOppMove(int chosenColor) {
        expand(oppNum, chosenColor);
    }

    // ================================================================
    // ===================== [필수 구현] ===============================
    // 가장 많은 중립 칸을 흡수할 수 있는 색상(1~6)을 선택해 반환
    // ================================================================
    int calculateMove(int myTime, int oppTime) {
        int bestColor = 1;
        int bestGain  = -1;

        for (int color = 1; color <= NUM_COLORS; color++) {
            // 현재 보드를 복사해서 시뮬레이션
            Cell sim[NR][NC];
            for (int r = 0; r < NR; r++)
                for (int c = 0; c < NC; c++)
                    sim[r][c] = grid[r][c];

            // sim에서 내 칸들을 color로 변경 후 흡수량 계산
            for (int r = 0; r < NR; r++)
                for (int c = 0; c < NC; c++)
                    if (sim[r][c].owner == myNum)
                        sim[r][c].color = color;

            int gain = simulate_expand(sim, myNum, color);
            if (gain > bestGain) {
                bestGain  = gain;
                bestColor = color;
            }
        }
        return bestColor;
    }
    // =================== [필수 구현 끝] =============================
};

// 표준 입력을 통해 명령어를 처리하는 메인 함수
int main() {
    Game game;

    while (true) {
        string line;
        if (!getline(cin, line)) break;

        istringstream iss(line);
        string command;
        if (!(iss >> command)) continue;

        if (command == "READY") {
            // 선공/후공 확인
            string turn;
            iss >> turn;
            game.setPlayerNum(turn == "FIRST" ? 1 : 2);
            cout << "OK" << endl;
            continue;
        }

        if (command == "INIT") {
            // 보드 초기화
            vector<string> rows;
            string row;
            while (iss >> row)
                rows.push_back(row);
            game.initBoard(rows);
            continue;
        }

        if (command == "TIME") {
            // 내 차례: 색상 계산 및 출력
            int myTime, oppTime;
            iss >> myTime >> oppTime;

            int chosenColor = game.calculateMove(myTime, oppTime);
            game.applyMyMove(chosenColor);

            cout << chosenColor << endl;
            continue;
        }

        if (command == "OPP") {
            // 상대방 행동 반영
            int oppColor, oppTime;
            iss >> oppColor >> oppTime;
            game.applyOppMove(oppColor);
            continue;
        }

        if (command == "FINISH") {
            break;
        }

        cerr << "Invalid command: " << command << "\n";
        return 1;
    }

    return 0;
}
