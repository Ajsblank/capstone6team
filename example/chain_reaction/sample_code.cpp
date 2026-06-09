#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
using namespace std;

const int NR = 6, NC = 6;

struct Cell { int count; int owner; };
Cell board[NR][NC];
int myNum, oppNum;

int capacity(int r, int c) {
    return 4 - (r==0||r==NR-1 ? 1 : 0) - (c==0||c==NC-1 ? 1 : 0);
}

void processExplosions(Cell b[NR][NC], int pNum) {
    bool changed = true;
    int iter = 0;
    while (changed && iter++ < 500) {
        changed = false;
        for (int r = 0; r < NR; r++) {
            for (int c = 0; c < NC; c++) {
                if (b[r][c].count >= capacity(r,c)) {
                    changed = true;
                    b[r][c].count -= capacity(r,c);
                    if (b[r][c].count == 0) b[r][c].owner = 0;
                    int dr[]={-1,1,0,0}, dc[]={0,0,-1,1};
                    for (int d = 0; d < 4; d++) {
                        int nr=r+dr[d], nc=c+dc[d];
                        if (nr<0||nr>=NR||nc<0||nc>=NC) continue;
                        b[nr][nc].count++;
                        b[nr][nc].owner = pNum;
                    }
                }
            }
        }
    }
}

// 해당 칸에 구슬을 놓았을 때 얻는 총 구슬 수 시뮬레이션
int simulate(int r, int c, int pNum) {
    Cell tmp[NR][NC];
    for (int i=0;i<NR;i++) for (int j=0;j<NC;j++) tmp[i][j]=board[i][j];
    tmp[r][c].owner = pNum;
    tmp[r][c].count++;
    processExplosions(tmp, pNum);
    int n = 0;
    for (int i=0;i<NR;i++) for (int j=0;j<NC;j++)
        if (tmp[i][j].owner==pNum) n += tmp[i][j].count;
    return n;
}

pair<int,int> chooseMove() {
    // 1순위: 임계 칸 (count == capacity-1) → 폭발 유발
    int bestR=-1, bestC=-1, bestVal=-1;
    for (int r=0;r<NR;r++) for (int c=0;c<NC;c++) {
        if (board[r][c].owner != 0 && board[r][c].owner != myNum) continue;
        int val = simulate(r, c, myNum);
        if (val > bestVal) { bestVal=val; bestR=r; bestC=c; }
    }
    if (bestR >= 0) return {bestR, bestC};

    // 빈 칸 중 랜덤
    vector<pair<int,int>> empties;
    for (int r=0;r<NR;r++) for (int c=0;c<NC;c++)
        if (board[r][c].owner==0) empties.push_back({r,c});
    if (!empties.empty()) {
        auto [r,c] = empties[rand()%empties.size()];
        return {r, c};
    }
    return {0, 0};
}

int main() {
    srand((unsigned)time(nullptr));
    string line;
    while (getline(cin, line)) {
        if (line.empty()) continue;
        istringstream iss(line);
        string cmd;
        iss >> cmd;

        if (cmd == "READY") {
            string side;
            iss >> side;
            myNum  = (side == "FIRST") ? 1 : 2;
            oppNum = 3 - myNum;
            cout << "OK" << endl;
        }
        else if (cmd == "INIT") {
            // INIT r0 r1 r2 r3 r4 r5
            for (int r = 0; r < NR; r++) {
                string row;
                iss >> row;
                for (int c = 0; c < NC; c++) {
                    char ch = row[c];
                    if (ch == '0') {
                        board[r][c] = {0, 0};
                    } else if (ch >= '1' && ch <= '3') {
                        board[r][c] = {ch-'0', 1};
                    } else { // '4'~'6' = p2
                        board[r][c] = {ch-'3', 2};
                    }
                }
            }
        }
        else if (cmd == "TIME") {
            auto [r, c] = chooseMove();
            // 내 보드에 반영
            board[r][c].owner = myNum;
            board[r][c].count++;
            processExplosions(board, myNum);
            cout << r << " " << c << endl;
        }
        else if (cmd == "OPP") {
            int r, c, t;
            iss >> r >> c >> t;
            if (r >= 0 && r < NR && c >= 0 && c < NC) {
                board[r][c].owner = oppNum;
                board[r][c].count++;
                processExplosions(board, oppNum);
            }
        }
        else if (cmd == "FINISH") {
            break;
        }
    }
    return 0;
}
