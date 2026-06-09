#include <iostream>
#include <string>
#include <sstream>
#include <vector>
#include <cstdlib>
#include <ctime>
#include <cstring>
using namespace std;

const int NR = 6, NC = 6;

int hlines[NR+1][NC]; // hlines[r][c]: r행 c~c+1 수평선
int vlines[NR][NC+1]; // vlines[r][c]: r~r+1행 c열 수직선
int boxes[NR][NC];    // 박스 소유자
int myNum, oppNum;

int countCapLeft(int br, int bc) {
    int n = 0;
    if (!hlines[br][bc])   n++;
    if (!hlines[br+1][bc]) n++;
    if (!vlines[br][bc])   n++;
    if (!vlines[br][bc+1]) n++;
    return n;
}

void applyMove(int r1, int c1, int r2, int c2, int pNum) {
    bool isHoriz = (r1 == r2);
    if (isHoriz) hlines[r1][c1] = pNum;
    else          vlines[r1][c1] = pNum;

    auto checkBox = [&](int br, int bc) {
        if (br < 0 || br >= NR || bc < 0 || bc >= NC) return;
        if (boxes[br][bc]) return;
        if (hlines[br][bc] && hlines[br+1][bc] &&
            vlines[br][bc] && vlines[br][bc+1])
            boxes[br][bc] = pNum;
    };
    if (isHoriz) { checkBox(r1-1, c1); checkBox(r1, c1); }
    else         { checkBox(r1, c1-1); checkBox(r1, c1); }
}

// 빈 선분 전체 수집
struct Line { int r1,c1,r2,c2; };

vector<Line> getEmptyLines() {
    vector<Line> lines;
    for (int r=0;r<=NR;r++) for (int c=0;c<NC;c++)
        if (!hlines[r][c]) lines.push_back({r,c,r,c+1});
    for (int r=0;r<NR;r++) for (int c=0;c<=NC;c++)
        if (!vlines[r][c]) lines.push_back({r,c,r+1,c});
    return lines;
}

Line chooseMove() {
    vector<Line> empties = getEmptyLines();

    // 1순위: 박스 완성 선분 (3면이 이미 놓인 박스)
    for (auto& ln : empties) {
        bool isH = (ln.r1 == ln.r2);
        // 임시 배치 후 박스 완성 여부 확인
        if (isH) hlines[ln.r1][ln.c1] = myNum;
        else     vlines[ln.r1][ln.c1] = myNum;

        bool made = false;
        auto checkBox = [&](int br, int bc) {
            if (br<0||br>=NR||bc<0||bc>=NC) return;
            if (boxes[br][bc]) return;
            if (hlines[br][bc]&&hlines[br+1][bc]&&vlines[br][bc]&&vlines[br][bc+1])
                made = true;
        };
        if (isH) { checkBox(ln.r1-1,ln.c1); checkBox(ln.r1,ln.c1); }
        else     { checkBox(ln.r1,ln.c1-1); checkBox(ln.r1,ln.c1); }

        if (isH) hlines[ln.r1][ln.c1] = 0;
        else     vlines[ln.r1][ln.c1] = 0;

        if (made) return ln;
    }

    // 2순위: 3면이 완성되지 않은 선분 (상대에게 박스 주지 않는 선분)
    // 배치 후 상대가 즉시 완성할 수 있는 박스가 생기지 않는 선분 우선
    for (auto& ln : empties) {
        bool isH = (ln.r1 == ln.r2);
        if (isH) hlines[ln.r1][ln.c1] = myNum;
        else     vlines[ln.r1][ln.c1] = myNum;

        bool giveAway = false;
        auto checkDanger = [&](int br, int bc) {
            if (br<0||br>=NR||bc<0||bc>=NC) return;
            if (boxes[br][bc]) return;
            if (countCapLeft(br, bc) == 1) giveAway = true;
        };
        if (isH) { checkDanger(ln.r1-1,ln.c1); checkDanger(ln.r1,ln.c1); }
        else     { checkDanger(ln.r1,ln.c1-1); checkDanger(ln.r1,ln.c1); }

        if (isH) hlines[ln.r1][ln.c1] = 0;
        else     vlines[ln.r1][ln.c1] = 0;

        if (!giveAway) return ln;
    }

    // 3순위: 랜덤
    if (!empties.empty()) return empties[rand() % empties.size()];
    return {0,0,0,1};
}

int main() {
    srand((unsigned)time(nullptr));
    memset(hlines, 0, sizeof(hlines));
    memset(vlines, 0, sizeof(vlines));
    memset(boxes,  0, sizeof(boxes));

    string line;
    while (getline(cin, line)) {
        if (line.empty()) continue;
        istringstream iss(line);
        string cmd;
        iss >> cmd;

        if (cmd == "READY") {
            string side; iss >> side;
            myNum  = (side == "FIRST") ? 1 : 2;
            oppNum = 3 - myNum;
            cout << "OK" << endl;
        }
        else if (cmd == "INIT") {
            // INIT 6 6 — 보드는 이미 빈 상태
        }
        else if (cmd == "TIME") {
            Line mv = chooseMove();
            applyMove(mv.r1, mv.c1, mv.r2, mv.c2, myNum);
            cout << mv.r1 << " " << mv.c1 << " " << mv.r2 << " " << mv.c2 << endl;
        }
        else if (cmd == "OPP") {
            int r1,c1,r2,c2,t;
            iss >> r1 >> c1 >> r2 >> c2 >> t;
            applyMove(r1, c1, r2, c2, oppNum);
        }
        else if (cmd == "FINISH") {
            break;
        }
    }
    return 0;
}
