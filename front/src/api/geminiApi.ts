import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY ?? "";
const MODEL   = "gemini-2.5-flash";

function getModel() {
  if (!API_KEY) throw new Error("REACT_APP_GEMINI_API_KEY가 설정되지 않았습니다.");
  const genAI = new GoogleGenerativeAI(API_KEY);
  return genAI.getGenerativeModel({ model: MODEL });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function stream(prompt: string, onChunk: (t: string) => void): Promise<string> {
  const result = await getModel().generateContentStream(prompt);
  let full = "";
  for await (const chunk of result.stream) {
    const text = chunk.text();
    full += text;
    onChunk(text);
  }
  return full;
}

// =============================================================
// 대회 개최 가이드라인 (contest-hosting-tutorial.md 기반)
// =============================================================

const TUTORIAL_GUIDE = `
[대회 개최 가이드라인]

## 전체 구조
채점 서버 동작 순서:
  Judge 실행 (개최자 제출 judge 코드)
    ├─ Player1 실행 (참가자 AI)
    └─ Player2 실행 (참가자 AI 또는 Sample AI)
  Judge의 마지막 stdout 줄을 읽어 승자 판정

- Judge: 게임 규칙 심판. 두 AI를 자식 프로세스로 실행, stdin/stdout으로 통신
- AI: Judge 지시에 따라 stdin으로 명령 수신, stdout으로 행동 출력
- Sample AI: 참가자에게 제공하는 AI 예시 코드 (전략이 단순해도 무방)

## 통신 규칙
- Judge ↔ AI는 표준 입출력(stdin/stdout)으로만 통신
- 명령어 이름, 데이터 포맷, 순서는 개최자가 자유롭게 설계
- 디버그 메시지는 반드시 stderr에만 출력 (stdout에 쓰면 Judge가 오파싱)
- 모든 출력 후 반드시 flush (endl / sys.stdout.flush() 등)

## Judge 최종 출력 형식 (채점 서버가 마지막 줄만 읽음)
<P1_결과> <P2_결과>
결과값: WIN | LOSE | TIME_LIMIT | MEMORY_LIMIT | RUNTIME_ERROR | NONE
예) WIN LOSE  / LOSE WIN  / NONE NONE

## Judge가 구현해야 할 것
1. 게임 보드/상태 초기화
2. AI 프로세스 실행 (fork + pipe)
3. 게임 시작 시 초기 정보 전송 (READY, INIT 등)
4. 매 턴 AI와 데이터 주고받기 (TIME, OPP 등)
5. 각 AI 행동 유효성 검사
6. 타임아웃 처리 (TIME_LIMIT)
7. 게임 종료 조건 판단 후 종료 신호 전송 (FINISH 등)
8. 마지막 줄에 결과 출력

## Sample AI가 구현해야 할 것
1. stdin으로 Judge 메시지 읽기
2. 행동 요청 메시지(TIME 등)에만 stdout으로 응답
3. 종료 신호(FINISH) 수신 시 정상 종료
4. 모든 출력에 flush 필수

## 시각화 HTML 규칙
- 독립 실행 가능한 단일 HTML 파일
- 외부 CDN 사용 가능
- postMessage로 로그 수신 가능: window.addEventListener("message", e => { if(e.data.type==="LOAD_LOG") ... })
- 로그 시각화: Judge stdout 로그를 업로드 → 턴별 재생
- 혼자 플레이: 브라우저에서 직접 게임 체험 (두 명이 번갈아 또는 혼자 양쪽 플레이)
`.trim();

// =============================================================
// 사과 게임 명세 (완성 예시)
// =============================================================

const APPLE_GAME_SPEC = `
[사과 게임 명세 — 완성 예시]

## 게임 규칙
- 보드: 10행 × 17열, 각 칸 1~9 숫자 (사과 개수)
- 행동: 직사각형 영역 (r1,c1)~(r2,c2) 선택
  - 영역 내 숫자 합이 정확히 10이어야 함
  - 직사각형의 네 변(r1행, r2행, c1열, c2열)에 각각 최소 1개 이상의 숫자가 있어야 함
  - 선택된 칸의 숫자는 0이 됨 (다음 턴부터 합산 제외)
  - 이미 0인 칸은 합산에서 제외되나 소유권 변경은 가능
- 패스: -1 -1 -1 -1 출력
- 종료: 양쪽이 연속으로 패스하면 게임 종료
- 승자: 더 많은 칸을 소유한 플레이어 승리

## 통신 프로토콜
| 명령 | 형식 | 설명 |
|---|---|---|
| READY | READY (FIRST\|SECOND) | 선/후공 정보. 3초 내 OK 출력 필수 |
| INIT | INIT r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 | 초기 보드 (각 ri는 17자리 숫자 문자열) |
| TIME | TIME t1 t2 | 내/상대 남은 시간(ms). r1 c1 r2 c2 형식으로 행동 출력 |
| OPP | OPP r1 c1 r2 c2 t | 상대 행동과 사용 시간 수신. 출력 불필요 |
| FINISH | FINISH | 게임 종료. 정상 종료 |

## Judge 로그 출력 형식 (시각화 HTML이 파싱하는 형식)
INIT <row0> <row1> ... <row9>
FIRST r1 c1 r2 c2 time_ms
SECOND r1 c1 r2 c2 time_ms
...
<P1결과> <P2결과>
`.trim();

// =============================================================
// 사과 게임 Judge 코드 (완성 예시 — C++)
// =============================================================

const APPLE_JUDGE_CODE = `
[사과 게임 Judge 코드 완성 예시 — C++]

\`\`\`cpp
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <chrono>
#include <random>
#include <unistd.h>
#include <sys/wait.h>
#include <poll.h>
#include <csignal>

using namespace std;

enum Result { NONE, WIN, LOSE, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR };
Result p1Result = WIN, p2Result = WIN;

const int ROWS = 10;
const int COLS = 17;
const int TOTAL_TIME_MS = 10000;
const int READY_TIMEOUT_MS = 3000;

string EnumToString(Result result) {
    switch(result) {
        case NONE: return "NONE";
        case WIN: return "WIN";
        case LOSE: return "LOSE";
        case TIME_LIMIT: return "TIME_LIMIT";
        case MEMORY_LIMIT: return "MEMORY_LIMIT";
        case RUNTIME_ERROR: return "RUNTIME_ERROR";
    }
    throw invalid_argument("Invalid Result");
}

struct Player {
    string name;
    int pid;
    int write_fd;
    int read_fd;
    int time_left_ms;
    Result result;
};

Player start_player(string name, string cmd) {
    int p_in[2], p_out[2];
    pipe(p_in); pipe(p_out);
    int pid = fork();
    if (pid == 0) {
        dup2(p_in[0], STDIN_FILENO);
        dup2(p_out[1], STDOUT_FILENO);
        close(p_in[0]); close(p_in[1]);
        close(p_out[0]); close(p_out[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        exit(1);
    }
    close(p_in[0]); close(p_out[1]);
    return {name, pid, p_in[1], p_out[0], TOTAL_TIME_MS, WIN};
}

void send_msg(Player& p, string msg) {
    msg += "\\n";
    write(p.write_fd, msg.c_str(), msg.size());
}

string recv_msg(Player& p, int timeout_ms, int& actual_time_ms) {
    auto start = chrono::steady_clock::now();
    string res = "";
    char c;
    struct pollfd pfd = {p.read_fd, POLLIN, 0};
    while (true) {
        int elapsed = chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - start).count();
        int remain = timeout_ms - elapsed;
        if (remain <= 0) break;
        int ret = poll(&pfd, 1, remain);
        if (ret > 0) {
            if (read(p.read_fd, &c, 1) > 0) {
                if (c == '\\n') { actual_time_ms = elapsed; return res; }
                if (c != '\\r') res += c;
            } else { actual_time_ms = elapsed; return "EOF"; }
        } else break;
    }
    actual_time_ms = chrono::duration_cast<chrono::milliseconds>(chrono::steady_clock::now() - start).count();
    return "TIMEOUT";
}

void terminate_player(Player& p) {
    kill(p.pid, SIGKILL);
    waitpid(p.pid, nullptr, 0);
    close(p.write_fd); close(p.read_fd);
}

class Game {
public:
    vector<vector<int>> board;
    vector<vector<int>> ownership;
    Game() {
        board.assign(ROWS, vector<int>(COLS, 0));
        ownership.assign(ROWS, vector<int>(COLS, 0));
        random_device rd; mt19937 gen(rd());
        uniform_int_distribution<int> dis(1, 9);
        for (int r = 0; r < ROWS; r++)
            for (int c = 0; c < COLS; c++)
                board[r][c] = dis(gen);
    }
    string get_init_string() {
        string s = "INIT ";
        for (int r = 0; r < ROWS; r++) {
            for (int c = 0; c < COLS; c++) s += to_string(board[r][c]);
            if (r != ROWS-1) s += " ";
        }
        return s;
    }
    bool is_valid_move(int r1, int c1, int r2, int c2) {
        if (!(0<=r1&&r1<=r2&&r2<ROWS&&0<=c1&&c1<=c2&&c2<COLS)) return false;
        int sums=0; bool r1f=false,r2f=false,c1f=false,c2f=false;
        for (int r=r1;r<=r2;r++) for (int c=c1;c<=c2;c++)
            if (board[r][c]>0) {
                sums+=board[r][c];
                if(r==r1)r1f=true; if(r==r2)r2f=true;
                if(c==c1)c1f=true; if(c==c2)c2f=true;
            }
        return (sums==10)&&r1f&&r2f&&c1f&&c2f;
    }
    void apply_move(int r1, int c1, int r2, int c2, int player_id) {
        for (int r=r1;r<=r2;r++) for (int c=c1;c<=c2;c++)
            { board[r][c]=0; ownership[r][c]=player_id; }
    }
};

int main(int argc, char* argv[]) {
    signal(SIGPIPE, SIG_IGN);
    if (argc != 3) { cerr << "사용법: ./judge <Player1> <Player2>\\n"; return 1; }

    Player p1 = start_player("FIRST", argv[1]);
    Player p2 = start_player("SECOND", argv[2]);
    Player* players[2] = {&p1, &p2};
    Game game;

    // READY
    send_msg(p1, "READY FIRST"); send_msg(p2, "READY SECOND");
    int dummy_time;
    if (recv_msg(p1, READY_TIMEOUT_MS, dummy_time) != "OK") {
        p1Result = RUNTIME_ERROR;
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << "\\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }
    if (recv_msg(p2, READY_TIMEOUT_MS, dummy_time) != "OK") {
        p2Result = RUNTIME_ERROR;
        cout << EnumToString(p1Result) << " " << EnumToString(p2Result) << "\\n";
        terminate_player(p1); terminate_player(p2); return 0;
    }

    // INIT
    string init_str = game.get_init_string();
    send_msg(p1, init_str); send_msg(p2, init_str);
    cout << init_str << "\\n";

    int turn = 0, consecutive_passes = 0;
    while (true) {
        Player& cur_p = *players[turn];
        Player& opp_p = *players[1-turn];
        int player_id = turn + 1;

        send_msg(cur_p, "TIME " + to_string(cur_p.time_left_ms) + " " + to_string(opp_p.time_left_ms));
        int actual_time_ms = 0;
        string resp = recv_msg(cur_p, cur_p.time_left_ms + 500, actual_time_ms);
        cur_p.time_left_ms -= max(0, actual_time_ms);

        if (resp == "EOF") { cur_p.result = RUNTIME_ERROR; break; }
        if (resp == "TIMEOUT" || cur_p.time_left_ms < 0) { cur_p.result = TIME_LIMIT; break; }

        int r1, c1, r2, c2;
        stringstream ss(resp);
        if (!(ss >> r1 >> c1 >> r2 >> c2)) { cur_p.result = RUNTIME_ERROR; break; }

        if (r1==-1 && c1==-1 && r2==-1 && c2==-1) {
            consecutive_passes++;
        } else {
            consecutive_passes = 0;
            if (!game.is_valid_move(r1, c1, r2, c2)) { cur_p.result = RUNTIME_ERROR; break; }
            game.apply_move(r1, c1, r2, c2, player_id);
        }

        send_msg(opp_p, "OPP " + to_string(r1) + " " + to_string(c1) + " " + to_string(r2) + " " + to_string(c2) + " " + to_string(max(0, actual_time_ms)));
        cout << (!turn?"FIRST ":"SECOND ") << r1 << " " << c1 << " " << r2 << " " << c2 << " " << actual_time_ms << "\\n";
        if (consecutive_passes == 2) break;
        turn = 1 - turn;
    }

    send_msg(p1, "FINISH"); send_msg(p2, "FINISH");
    usleep(500000);
    terminate_player(p1); terminate_player(p2);

    if (players[0]->result == WIN && players[1]->result == WIN) {
        int a=0, b=0;
        for (int i=0;i<ROWS;i++) for (int j=0;j<COLS;j++) {
            if (game.ownership[i][j]==1) a++;
            else if (game.ownership[i][j]==2) b++;
        }
        if (a<b) players[0]->result = LOSE;
        if (a>b) players[1]->result = LOSE;
    }
    cout << EnumToString(players[0]->result) << " " << EnumToString(players[1]->result) << "\\n";
    return 0;
}
\`\`\`
`.trim();

// =============================================================
// 사과 게임 Sample AI 코드 (완성 예시 — C++)
// =============================================================

const APPLE_SAMPLE_CODE = `
[사과 게임 Sample AI 코드 완성 예시 — C++]

\`\`\`cpp
#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
using namespace std;

class Game {
private:
    vector<vector<int>> board;
    bool first;
    bool passed;
public:
    Game() {}
    Game(const vector<vector<int>>& board, bool first)
        : board(board), first(first), passed(false) {}

    bool isValid(int r1, int c1, int r2, int c2) {
        int sums = 0;
        bool r1fit=false, c1fit=false, r2fit=false, c2fit=false;
        for (int r=r1;r<=r2;r++) for (int c=c1;c<=c2;c++)
            if (board[r][c] != 0) {
                sums += board[r][c];
                if(r==r1)r1fit=true; if(r==r2)r2fit=true;
                if(c==c1)c1fit=true; if(c==c2)c2fit=true;
            }
        return (sums==10) && r1fit && r2fit && c1fit && c2fit;
    }

    // ================================================================
    // ===================== [필수 구현] ===============================
    // 합이 10인 유효한 사각형을 찾아 {r1, c1, r2, c2} 벡터로 반환
    // 없으면 {-1, -1, -1, -1}을 반환하여 패스를 의미함
    // ================================================================
    vector<int> calculateMove(int myTime, int oppTime) {
        // 가로로 인접한 두 칸 선택 전략
        for (int r1=0;r1<(int)board.size();r1++)
            for (int c1=0;c1<(int)board[r1].size()-1;c1++) {
                int r2=r1, c2=c1+1;
                if (isValid(r1,c1,r2,c2)) return {r1,c1,r2,c2};
            }
        return {-1,-1,-1,-1};
    }
    // =================== [필수 구현 끝] =============================

    void updateMove(int r1, int c1, int r2, int c2, bool isMyMove) {
        if (r1==-1 && c1==-1 && r2==-1 && c2==-1) { passed=true; return; }
        for (int r=r1;r<=r2;r++) for (int c=c1;c<=c2;c++) board[r][c]=0;
        passed=false;
    }
    void updateOpponentAction(const vector<int>& action, int time) {
        updateMove(action[0],action[1],action[2],action[3],false);
    }
};

int main() {
    Game game;
    bool first = false;
    while (true) {
        string line;
        getline(cin, line);
        istringstream iss(line);
        string command;
        if (!(iss >> command)) continue;

        if (command == "READY") {
            string turn; iss >> turn;
            first = (turn == "FIRST");
            cout << "OK" << endl;
        }
        else if (command == "INIT") {
            vector<vector<int>> board;
            string row;
            while (iss >> row) {
                vector<int> boardRow;
                for (char c : row) boardRow.push_back(c - '0');
                board.push_back(boardRow);
            }
            game = Game(board, first);
        }
        else if (command == "TIME") {
            int myTime, oppTime; iss >> myTime >> oppTime;
            vector<int> ret = game.calculateMove(myTime, oppTime);
            game.updateMove(ret[0],ret[1],ret[2],ret[3],true);
            cout << ret[0] << " " << ret[1] << " " << ret[2] << " " << ret[3] << endl;
        }
        else if (command == "OPP") {
            int r1,c1,r2,c2,time; iss >> r1 >> c1 >> r2 >> c2 >> time;
            game.updateOpponentAction({r1,c1,r2,c2}, time);
        }
        else if (command == "FINISH") break;
        else { cerr << "Invalid command: " << command << endl; return 1; }
    }
    return 0;
}
\`\`\`
`.trim();

// =============================================================
// 사과 게임 로그 시각화 HTML (완성 예시 — 핵심 구조)
// =============================================================

const APPLE_VIZ_HTML_GUIDE = `
[사과 게임 로그 시각화 HTML 완성 예시 — 핵심 구조]

파싱하는 로그 형식:
  INIT <row0> <row1> ... <row9>     ← 각 row는 17자리 숫자 문자열
  FIRST r1 c1 r2 c2 time_ms         ← 선공의 수 (패스면 -1 -1 -1 -1 0)
  SECOND r1 c1 r2 c2 time_ms        ← 후공의 수
  ...
  WIN LOSE (또는 LOSE WIN, NONE NONE 등)  ← 최종 결과

주요 기능:
- 로그 파일 드래그&드롭 업로드 (또는 클릭)
- ◀ ▶ 버튼 및 슬라이더로 턴 이동
- ▶ 재생 버튼 + 속도 조절 (0.5× ~ 16×)
- 힌트 켜기: 합이 10이 될 수 있는 칸 강조
- 로그 패널에서 특정 줄 클릭 → 해당 턴으로 이동
- 키보드: ← → 턴 이동, Space 재생/정지
- postMessage 연동: window.addEventListener("message", e => { if(e.data.type==="LOAD_LOG") loadLog(e.data.log); })
- 10×17 그리드 보드 (각 셀 40×40px)
- 선공 점령: 파란 배경 (#b3e5fc), 후공 점령: 보라 배경 (#e1bee7)
- 어두운 배경 테마 (background: #1a1a2e)
- 두 플레이어 카드 (선공 파란색, 후공 보라색) + 점수 표시
- 로그 라인 색상: INIT=주황, FIRST=파랑, SECOND=보라, 결과=초록
`.trim();

// =============================================================
// 사과 게임 혼자 플레이 HTML (완성 예시 — 핵심 구조)
// =============================================================

const APPLE_SOLO_HTML_GUIDE = `
[사과 게임 혼자 플레이 HTML 완성 예시 — 핵심 구조]

주요 기능:
- 브라우저에서 두 명이 번갈아 플레이 (또는 혼자 양쪽)
- 마우스 드래그로 직사각형 영역 선택
- 실시간 합계 피드백: 노란 테두리(합<10), 빨간(합>10), 주황(경계 조건 불만족), 초록(유효)
- 힌트 켜기: 선택 가능한 칸 강조 (초록 배경)
- 스킵 버튼 / 새 게임 버튼
- 모바일 터치 지원 (touchstart, touchmove, touchend)
- 우측 로그 패널: 게임 진행 기록 (INIT, FIRST/SECOND 수, 최종 결과)
- 게임 종료 시 결과 배너 표시
- 10×17 그리드 보드 (각 셀 40×40px)
- 선공 점령: 파란 배경 (#b3e5fc), 후공 점령: 보라 배경 (#e1bee7)
- 어두운 배경 테마 (background: #1a1a2e)

보드 초기화: 각 칸 1~9 랜덤 숫자
유효성 검사: 영역 내 양수 칸 합 = 10, 네 변에 각 최소 1개 이상
`.trim();

// =============================================================
// 공통 맥락 조합 헬퍼
// =============================================================

function buildContext(...sections: string[]): string {
  return sections.join("\n\n---\n\n");
}

// =============================================================
// 1단계: 게임 입출력 형식 설계
// =============================================================

export async function generateIOFormat(
  description: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const prompt = [
    buildContext(TUTORIAL_GUIDE, APPLE_GAME_SPEC),
    ``,
    `위 가이드라인과 사과 게임 완성 예시를 참고하여, 아래 게임의 통신 프로토콜을 설계하세요.`,
    ``,
    `새로운 게임 설명:`,
    `---`,
    description,
    `---`,
    ``,
    `요구사항:`,
    `- 사과 게임과 동일한 Judge↔AI stdin/stdout 통신 구조를 따르되, 이 게임에 맞게 새로 설계하세요.`,
    `- READY/INIT/TIME/OPP/FINISH 패턴을 참고하되, 이 게임에 맞는 명령어와 데이터 포맷을 자유롭게 정의하세요.`,
    `- INIT 명령의 데이터 형식을 이 게임의 보드/상태에 맞게 구체적으로 정의하세요.`,
    `- TIME 명령에서 출력해야 할 행동 형식을 구체적으로 정의하세요.`,
    `- OPP 명령에서 전달되는 상대 행동 형식을 정의하세요.`,
    `- Judge 마지막 줄 형식: <P1결과> <P2결과> (WIN/LOSE/TIME_LIMIT/MEMORY_LIMIT/RUNTIME_ERROR/NONE)`,
    `- 로그 시각화를 위한 Judge stdout 로그 형식도 정의하세요 (INIT 줄, 각 턴 줄, 최종 결과 줄).`,
    `- 마크다운 표 형식으로 출력하고, 각 명령 아래에 입출력 예시를 포함하세요.`,
  ].join("\n");
  return stream(prompt, onChunk);
}

// =============================================================
// 2단계: 채점 코드(Judge) 생성
// =============================================================

export async function generateJudgeCode(
  description: string,
  ioFormat: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const prompt = [
    buildContext(TUTORIAL_GUIDE, APPLE_JUDGE_CODE),
    ``,
    `위 가이드라인과 사과 게임 Judge 코드 완성 예시를 참고하여, 아래 게임의 Judge 코드를 작성하세요.`,
    `사과 게임 Judge 코드를 그대로 참고하되, 이 게임에 맞게 완전히 새로 구현해야 합니다.`,
    ``,
    `새로운 게임 설명:`,
    `---`,
    description,
    `---`,
    ``,
    `확정된 입출력 프로토콜:`,
    `---`,
    ioFormat,
    `---`,
    ``,
    `Judge 코드 요구사항:`,
    `- 두 플레이어 프로세스(subprocess)를 fork+pipe로 실행하고 stdin/stdout으로 통신`,
    `- 위 프로토콜에 따라 READY → INIT → (TIME → OPP) 반복 → FINISH 순서로 진행`,
    `- 각 플레이어 행동 유효성 검사 및 시간 초과(TIME_LIMIT) 처리`,
    `- EOF/파싱 실패 시 RUNTIME_ERROR 처리`,
    `- 게임 규칙에 따라 상태 관리 및 승패 판정`,
    `- Judge stdout 마지막 줄: <P1결과> <P2결과> 형식 (채점 서버가 이 줄만 읽음)`,
    `- 시각화를 위한 로그도 stdout에 출력 (INIT 줄 + 각 턴 줄)`,
    `- signal(SIGPIPE, SIG_IGN) 포함`,
    `- 완전히 동작하는 C++ 코드만 출력하세요.`,
  ].join("\n");
  return stream(prompt, onChunk);
}

// =============================================================
// 3단계: 스켈레톤(Sample AI) 코드 생성
// =============================================================

export async function generateSkeletonCode(
  ioFormat: string,
  judgeCode: string,
  language: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const prompt = [
    buildContext(TUTORIAL_GUIDE, APPLE_SAMPLE_CODE),
    ``,
    `위 가이드라인과 사과 게임 Sample AI 코드 완성 예시를 참고하여, 아래 프로토콜을 따르는 ${language} Sample AI 스켈레톤 코드를 작성하세요.`,
    `사과 게임처럼 완전히 동작하는 기본 전략을 포함해야 합니다.`,
    ``,
    `입출력 프로토콜:`,
    `---`,
    ioFormat,
    `---`,
    ``,
    `채점 코드 (참고용):`,
    `---`,
    judgeCode.slice(0, 3000),
    `---`,
    ``,
    `Sample AI 코드 요구사항:`,
    `- 프로토콜의 모든 명령을 처리하는 메인 루프 구현`,
    `- 게임 상태를 저장하는 자료구조 정의`,
    `- TIME 명령 처리 부분에 [필수 구현] / [필수 구현 끝] 주석으로 전략 구현 위치 표시`,
    `- 기본 동작(랜덤 또는 간단한 휴리스틱)은 구현하여 완전히 동작하게 할 것`,
    `- 모든 출력에 즉시 flush (endl / sys.stdout.flush() 등) 포함`,
    `- 디버그는 stderr에만 출력`,
    `- 완전히 동작하는 ${language} 코드만 출력하세요.`,
  ].join("\n");
  return stream(prompt, onChunk);
}

// =============================================================
// 4단계: 예시 AI 코드 생성
// =============================================================

export async function generateExampleAICode(
  skeletonCode: string,
  strategy: string,
  language: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const prompt = [
    buildContext(TUTORIAL_GUIDE, APPLE_SAMPLE_CODE),
    ``,
    `위 가이드라인과 사과 게임 Sample AI 코드 완성 예시를 참고하여, 아래 스켈레톤 코드의 [필수 구현] 부분을 전략으로 채워 완성된 예시 AI 코드를 작성하세요.`,
    ``,
    `스켈레톤 코드:`,
    `---`,
    skeletonCode,
    `---`,
    ``,
    `구현할 전략:`,
    `---`,
    strategy || "탐욕 알고리즘(greedy) 기반의 기본 전략을 구현하세요.",
    `---`,
    ``,
    `요구사항:`,
    `- 스켈레톤 코드 구조를 유지하면서 [필수 구현] 부분의 전략 로직만 구현`,
    `- 시간 초과가 발생하지 않도록 효율적으로 구현`,
    `- 모든 출력에 즉시 flush 포함`,
    `- 완전히 동작하는 ${language} 코드만 출력하세요.`,
  ].join("\n");
  return stream(prompt, onChunk);
}

// =============================================================
// 시각화 HTML 생성 (로그 시각화 또는 혼자 플레이)
// =============================================================

export async function generateVisualHtml(
  description: string,
  sampleCodeContent: string,
  mode: "visualization" | "solo",
  onChunk: (t: string) => void,
): Promise<string> {
  const isViz = mode === "visualization";
  const modeGuide = isViz ? APPLE_VIZ_HTML_GUIDE : APPLE_SOLO_HTML_GUIDE;
  const modeDesc = isViz
    ? "Judge가 출력한 게임 로그 파일을 업로드하면 대결을 턴별로 재생할 수 있는 로그 시각화 뷰어 HTML"
    : "두 명이 번갈아 또는 혼자 양쪽을 플레이해볼 수 있는 인터랙티브 HTML (마우스/터치 지원)";

  const codeSection = sampleCodeContent
    ? `\n참고 Sample AI 코드:\n\`\`\`\n${sampleCodeContent.slice(0, 2000)}\n\`\`\``
    : "";

  const prompt = [
    buildContext(TUTORIAL_GUIDE, APPLE_GAME_SPEC, modeGuide),
    ``,
    `위 가이드라인과 사과 게임 ${isViz ? "로그 시각화" : "혼자 플레이"} HTML 완성 예시를 참고하여,`,
    `아래 게임을 위한 ${modeDesc}를 단일 HTML 파일로 작성하세요.`,
    `사과 게임 예시와 동일한 수준의 완성도로 이 게임에 맞게 새로 구현해야 합니다.`,
    ``,
    `새로운 게임 설명:`,
    `---`,
    description,
    `---`,
    codeSection,
    ``,
    `요구사항:`,
    `- 순수 HTML/CSS/JavaScript만 사용 (외부 CDN 허용)`,
    `- 완전한 단일 파일 (<!DOCTYPE html>부터 </html>까지)`,
    `- 어두운 배경 테마, 반응형 디자인`,
    isViz
      ? `- 로그 파싱: INIT 줄로 초기 보드 구성, FIRST/SECOND 줄로 턴 재생, 마지막 줄로 결과 표시`
      : `- 마우스 드래그 선택, 실시간 유효성 피드백, 스킵/새게임 버튼, 터치 지원`,
    isViz
      ? `- postMessage({ type: "LOAD_LOG", log: "..." }) 로그 수신 지원`
      : `- 우측 로그 패널에서 게임 진행 기록 표시`,
    `- HTML 코드만 출력하세요. 설명 없이 코드만 작성하세요.`,
  ].join("\n");

  return stream(prompt, onChunk);
}
