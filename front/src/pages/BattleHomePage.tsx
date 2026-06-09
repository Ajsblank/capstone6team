import React, { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { useApp } from "../context/AppContext";
import ProfileBadge from "../components/ProfileBadge";
import ResponsiveNavMenu from "../components/ResponsiveNavMenu";
import { getContestList, ContestItem } from "../api/codeBattleApi";
import TermsAgreementModal from "../components/TermsAgreementModal";
import "./AppLayout.css";
import "./BattleHomePage.css";

type BattleTab = "contest" | "previous-problems" | "help" | "contact";
type StatusFilter = "" | "RUNNING" | "PLANNED" | "END";

const FETCH_SIZE = 100;
const VALID_BATTLE_TABS: BattleTab[] = ["contest", "previous-problems", "help", "contact"];

// ── Judge 뼈대 코드 (MD 파일 섹션 5) ──
const JUDGE_SKELETON_CPP = `#include <iostream>
#include <string>
#include <sstream>
#include <chrono>
#include <unistd.h>
#include <sys/wait.h>
#include <poll.h>
using namespace std;

// === 결과 열거형 (채점 서버가 인식하는 값 그대로 사용) ===
enum Result { NONE, WIN, LOSE, TIME_LIMIT, MEMORY_LIMIT, RUNTIME_ERROR };

string resultToString(Result r) {
    switch(r) {
        case WIN:           return "WIN";
        case LOSE:          return "LOSE";
        case TIME_LIMIT:    return "TIME_LIMIT";
        case MEMORY_LIMIT:  return "MEMORY_LIMIT";
        case RUNTIME_ERROR: return "RUNTIME_ERROR";
        default:            return "NONE";
    }
}

// === AI 프로세스 정보 ===
struct Player {
    int pid;
    int write_fd; // Judge → AI (AI의 stdin)
    int read_fd;  // AI → Judge (AI의 stdout)
    int time_left_ms;
    Result result;
};

// === AI 프로세스 시작 ===
Player startPlayer(const string& cmd, int totalTimeMs) {
    int p_in[2], p_out[2];
    pipe(p_in); pipe(p_out);
    int pid = fork();
    if (pid == 0) { // 자식: AI
        dup2(p_in[0], STDIN_FILENO);
        dup2(p_out[1], STDOUT_FILENO);
        close(p_in[0]); close(p_in[1]);
        close(p_out[0]); close(p_out[1]);
        execl("/bin/sh", "sh", "-c", cmd.c_str(), nullptr);
        exit(1);
    }
    close(p_in[0]); close(p_out[1]);
    return {pid, p_in[1], p_out[0], totalTimeMs, WIN};
}

// === AI에게 메시지 전송 ===
void sendMsg(Player& p, const string& msg) {
    string s = msg + "\\n";
    write(p.write_fd, s.c_str(), s.size());
}

// === AI로부터 응답 수신 (타임아웃 포함) ===
string recvMsg(Player& p, int timeoutMs, int& elapsedMs) {
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
                if (c == '\\n') { elapsedMs = elapsed; return res; }
                if (c != '\\r') res += c;
            } else { break; }
        } else { break; }
    }
    elapsedMs = chrono::duration_cast<chrono::milliseconds>(
        chrono::steady_clock::now() - start).count();
    return "TIMEOUT";
}

// === AI 종료 ===
void terminatePlayer(Player& p) {
    kill(p.pid, SIGKILL);
    waitpid(p.pid, nullptr, 0);
    close(p.write_fd);
    close(p.read_fd);
}

int main(int argc, char* argv[]) {
    if (argc != 3) {
        cerr << "사용법: ./judge <player1> <player2>\\n";
        return 1;
    }

    const int TOTAL_TIME_MS = 10000;  // ← 게임 제한 시간 설정
    const int READY_TIMEOUT_MS = 3000;

    Player p1 = startPlayer(argv[1], TOTAL_TIME_MS);
    Player p2 = startPlayer(argv[2], TOTAL_TIME_MS);

    // ── 게임 시작: AI에게 초기 정보 전송 ────────────
    // TODO: 게임 상태 초기화
    // TODO: 초기 정보 포맷은 자유롭게 설계
    //   예) sendMsg(p1, "초기정보 문자열");
    //       sendMsg(p2, "초기정보 문자열");
    // TODO: 필요하다면 AI의 준비 응답을 받아 검증
    //   예) int dummy; string ack = recvMsg(p1, 3000, dummy);
    //       if (ack != "OK") { p1.result = ERROR; ... }

    // ── 게임 루프 ──────────────────────────────────
    // 프로토콜 구조는 게임마다 다릅니다.
    // 아래는 "현재 플레이어에게 게임 상태를 보내고 행동을 받는" 일반적인 패턴입니다.
    Player* players[2] = {&p1, &p2};
    int turn = 0;

    while (true) {
        Player& cur = *players[turn];
        Player& opp = *players[1 - turn];

        // TODO: 현재 플레이어에게 게임 상태 / 요청 전송
        //   예) sendMsg(cur, buildGameStateString());
        int elapsed = 0;
        string resp = recvMsg(cur, cur.time_left_ms + 500, elapsed);
        cur.time_left_ms -= max(0, elapsed);

        if (resp == "TIMEOUT" || cur.time_left_ms < 0) {
            cur.result = TIME_LIMIT;
            break;
        }

        // TODO: 행동 파싱 및 유효성 검사
        // if (!isValidMove(resp)) { cur.result = ERROR; break; }
        // applyMove(resp, turn + 1);

        // TODO: 필요하다면 상대 AI에게 이번 턴 결과 전달
        //   예) sendMsg(opp, buildOpponentMoveString(resp));

        // TODO: 게임 종료 조건 확인
        // if (isGameOver()) break;

        turn = 1 - turn;
    }

    // ── 게임 종료 신호 전송 ────────────────────────
    // TODO: AI에게 종료를 알리는 메시지 전송 (형식 자유)
    //   예) sendMsg(p1, "END"); sendMsg(p2, "END");
    usleep(500000);
    terminatePlayer(p1);
    terminatePlayer(p2);

    // TODO: 최종 승자 판정 (보드 상태 등으로 WIN/LOSE 결정)
    // if (p1Score > p2Score) p2.result = LOSE;
    // else if (p2Score > p1Score) p1.result = LOSE;

    // ★ 마지막 줄 반드시 이 형식으로 출력 (채점 서버가 이 줄만 읽음)
    cout << resultToString(p1.result) << " " << resultToString(p2.result) << "\\n";
    return 0;
}`;

// ── Sample AI 뼈대 코드 (MD 파일 섹션 6) ──
const SAMPLE_CODE_CPP = `#include <iostream>
#include <string>
#include <sstream>
using namespace std;

int main() {
    while (true) {
        string line;
        getline(cin, line);
        if (line.empty()) continue;

        istringstream iss(line);
        string cmd;
        iss >> cmd;

        if (cmd == "<초기화_명령>") {
            // TODO: Judge가 보낸 초기 정보 파싱 (게임 상태, 보드 등)
            // 응답이 필요하다면: cout << "OK" << endl;
        }
        else if (cmd == "<행동_요청_명령>") {
            // TODO: 게임 상태를 바탕으로 행동 계산
            cout << "<행동 문자열>" << endl;  // endl로 즉시 flush 필수!
        }
        else if (cmd == "<상대행동_알림_명령>") {
            // TODO: 상대방 행동을 게임 상태에 반영 (응답 불필요)
        }
        else if (cmd == "<종료_명령>") {
            break;
        }
    }
    return 0;
}`;

const SAMPLE_CODE_JAVA = `import java.util.Scanner;

public class player1 {  // 파일명과 클래스명 일치 필수
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextLine()) {
            String line = sc.nextLine().trim();
            String[] parts = line.split(" ");
            String cmd = parts[0];

            if (cmd.equals("<초기화_명령>")) {
                // TODO: 초기 정보 파싱
                // 응답 필요 시: System.out.println("OK"); System.out.flush();
            } else if (cmd.equals("<행동_요청_명령>")) {
                // TODO: 행동 계산
                System.out.println("<행동 문자열>");
                System.out.flush();  // flush 필수!
            } else if (cmd.equals("<종료_명령>")) {
                break;
            }
        }
    }
}`;

const SAMPLE_CODE_PYTHON = `import sys

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    parts = line.split()
    cmd = parts[0]

    if cmd == "<초기화_명령>":
        # TODO: 초기 정보 파싱
        # 응답 필요 시: print("OK", flush=True)
        pass
    elif cmd == "<행동_요청_명령>":
        # TODO: 행동 계산
        print("<행동 문자열>", flush=True)  # flush=True 필수!
    elif cmd == "<종료_명령>":
        break`;

// ── Monaco 기반 Judge 코드 가이드 (펼쳐보기 + 스텝 하이라이트) ──
interface MonacoStep { text: React.ReactNode; start: number; end: number; }

const MonacoCodeGuide: React.FC<{
  codeLabel: string;
  code: string;
  language?: string;
  steps?: MonacoStep[];
}> = ({ codeLabel, code, language = "cpp", steps = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeRange, setActiveRange] = useState<[number, number] | null>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decsRef = useRef<string[]>([]);

  const applyDec = useCallback((start: number, end: number) => {
    if (!editorRef.current || !monacoRef.current) return;
    decsRef.current = editorRef.current.deltaDecorations(decsRef.current, [{
      range: new monacoRef.current.Range(start, 1, end, 1),
      options: { isWholeLine: true, className: "bp-monaco-line-active" },
    }]);
    editorRef.current.revealLineInCenter(start, 0);
  }, []);

  const handleStepClick = (start: number, end: number) => {
    setActiveRange([start, end]);
    setIsOpen(true);
    if (editorRef.current && monacoRef.current) {
      requestAnimationFrame(() => applyDec(start, end));
    }
  };

  const handleMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (activeRange) {
      requestAnimationFrame(() => applyDec(activeRange[0], activeRange[1]));
    }
  };

  return (
    <>
      {steps.length > 0 && (
        <ol className="bp-info-list bp-code-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <button type="button" className="bp-code-step-btn" onClick={() => handleStepClick(s.start, s.end)}>
                {s.text}
              </button>
            </li>
          ))}
        </ol>
      )}
      <details
        className="bp-code-collapse"
        open={isOpen}
        onToggle={e => setIsOpen(e.currentTarget.open)}
      >
        <summary className="bp-code-summary">{codeLabel}</summary>
        {isOpen && (
          <div style={{ height: 480 }}>
            <Editor
              height="100%"
              language={language}
              value={code}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: "on",
                wordWrap: "off",
              }}
              onMount={handleMount}
            />
          </div>
        )}
      </details>
    </>
  );
};

// ── Monaco 기반 Sample AI 코드 가이드 (언어 선택 + 펼쳐보기) ──
const MonacoSampleGuide: React.FC<{
  codeLabel: string;
  codes: { cpp: string; java: string; python: string };
}> = ({ codeLabel, codes }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<"cpp" | "java" | "python">("cpp");

  const LANG_LABELS: Record<string, string> = { cpp: "C++", java: "Java", python: "Python" };
  const MONACO_LANG: Record<string, string> = { cpp: "cpp", java: "java", python: "python" };

  return (
    <details
      className="bp-code-collapse"
      open={isOpen}
      onToggle={e => setIsOpen(e.currentTarget.open)}
    >
      <summary className="bp-code-summary">{codeLabel}</summary>
      {isOpen && (
        <>
          <div className="bp-sample-lang-tabs">
            {(["cpp", "java", "python"] as const).map(l => (
              <button
                key={l}
                type="button"
                className={"bp-lang-tab" + (lang === l ? " bp-lang-tab--active" : "")}
                onClick={() => setLang(l)}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <div style={{ height: 380 }}>
            <Editor
              key={lang}
              height="100%"
              language={MONACO_LANG[lang]}
              value={codes[lang]}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: "on",
                wordWrap: "off",
              }}
            />
          </div>
        </>
      )}
    </details>
  );
};

const HELP_ITEMS: { title: string; summary: string; body: React.ReactNode; hasTutorial?: boolean }[] = [
  {
    title: "Tactical Code Battle란?",
    summary: "플랫폼 개요 및 핵심 개념",
    body: (
      <>
        <p className="bp-info-text">
          Tactical Code Battle(TCB)는 참가자가 작성한 <strong>AI 코드끼리 자동으로 대결</strong>하는 알고리즘 경쟁 플랫폼입니다.
          전략을 코드로 구현해 제출하면 서버가 예시 AI와 매치를 진행하고, 스위스 토너먼트 세션을 통해 참가자들의 순위를 결정합니다.
        </p>
        <p className="bp-info-text">
          로그 분석 뷰어로 매치 과정을 시각적으로 재현하거나, 혼자서 하기 기능으로 자신의 전략을 직접 시험해볼 수 있습니다.
        </p>
        <div className="bp-info-badges" style={{ marginTop: 4 }}>
          {["C++20", "Java 21", "Python3 / PyPy3"].map(lang => (
            <span key={lang} className="bp-info-badge">{lang}</span>
          ))}
        </div>
      </>
    ),
  },
  {
    title: "대회 진행 방식",
    summary: "참가 신청부터 최종 결과까지",
    body: (
      <ol className="bp-info-list">
        <li>대회 목록에서 원하는 대회를 선택하고 <strong>대회 참가</strong> 버튼을 클릭합니다.</li>
        <li><strong>문제</strong> 탭에서 게임 규칙과 입출력 형식을 확인합니다.</li>
        <li><strong>제출</strong> 탭에서 전략 코드를 작성하고 제출합니다. 횟수 제한은 없으며, 세션 시작 시점의 최신 코드가 사용됩니다.</li>
        <li>세션이 시작되면 <strong>스위스 토너먼트</strong> 방식으로 라운드가 진행됩니다. 비슷한 점수대 참가자끼리 매칭되며,
          승리 <strong>+1점</strong> / 무승부 <strong>0점</strong> / 패배 <strong>-1점</strong>이 부여됩니다.</li>
        <li><strong>중간 결과</strong> 탭에서 세션 진행 상황과 실시간 순위를 확인할 수 있습니다.</li>
        <li>대회 종료 시간이 되면, <strong>풀리그 방식</strong> 으로 최종 결과를 산출합니다. <strong>최종 결과</strong> 탭에서 대회 최종 순위를 확인합니다.</li>
      </ol>
    ),
  },
  {
    title: "인증 · 비인증 대회의 차이",
    summary: "공식 인증 대회와 일반 대회 비교",
    body: (
      <div className="bp-help-compare">
        <div className="bp-help-compare-col bp-help-compare-col--uncert">
          <div className="bp-help-compare-head">비인증 대회</div>
          <ul className="bp-info-list">
            <li>로그인한 누구나 즉시 개설 가능</li>
            <li>시각화 · 혼자서 하기 파일 선택 사항</li>
            <li>테스트 · 연습 목적에 적합</li>
          </ul>
        </div>
        <div className="bp-help-compare-col bp-help-compare-col--cert">
          <div className="bp-help-compare-head">인증 대회</div>
          <ul className="bp-info-list">
            <li>플랫폼 운영팀의 공식 검수 필요</li>
            <li>시각화 · 혼자서 하기 파일 <strong>필수</strong></li>
            <li>공식 경쟁 · 수료 목적에 적합</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: "대회 개최 방법",
    summary: "Judge · Sample AI 작성부터 제출까지",
    hasTutorial: true,
    body: (
      <>
        <p className="bp-info-text">
          처음 대회를 개최하는 분을 위한 가이드입니다.
        </p>

        <table className="bp-tut-table">
          <thead>
            <tr><th>파일</th><th>필수 여부</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td>Judge 코드</td><td><strong>필수</strong></td><td>게임 규칙 판단</td></tr>
            <tr><td>Sample AI 코드</td><td><strong>필수</strong></td><td>참가자에게 제공하는 예시 AI 스켈레톤 코드</td></tr>
            <tr><td>로그 시각화 HTML</td><td>선택</td><td>대결 로그를 브라우저에서 재생</td></tr>
            <tr><td>혼자 플레이 HTML</td><td>선택</td><td>브라우저에서 직접 게임을 체험</td></tr>
          </tbody>
        </table>

        {/* 1 */}
        <h4 className="bp-tut-h">1. 전체 구조 이해하기</h4>
        <p className="bp-info-text">대회에서 두 AI 봇이 대결할 때, 채점 서버는 다음 순서로 동작합니다.</p>
        <pre className="bp-tut-code">{`채점 서버
    │
    ├─ Judge 실행  ←  개최자가 제출한 judge 코드
    │       │
    │       ├─ Player1 실행  ←  참가자 AI
    │       └─ Player2 실행  ←  참가자 AI (또는 Sample AI)
    │
    └─ Judge의 마지막 출력을 읽어 승자 판정`}</pre>
        <ul className="bp-info-list">
          <li><strong>Judge</strong> — 게임 규칙의 심판. 두 AI를 자식 프로세스로 직접 실행하고, stdin/stdout으로 통신하며 게임을 진행합니다.</li>
          <li><strong>AI (Player)</strong> — Judge의 지시에 따라 stdin으로 명령을 받고, stdout으로 행동을 출력합니다.</li>
          <li><strong>Sample AI</strong> — 참가자들에게 제공하는 AI 예시 코드입니다. 이 코드를 기반으로 참가자들이 전략을 개선합니다.</li>
        </ul>

        {/* 2 */}
        <h4 className="bp-tut-h">2. Judge 코드란?</h4>
        <p className="bp-info-text">
          Judge 코드는 <strong>게임 규칙 그 자체</strong>입니다. 개최자가 직접 설계한 게임의 보드, 규칙, 승패 조건을 모두 Judge 코드 안에 구현합니다.
        </p>
        <p className="bp-info-text">Judge가 해야 할 일:</p>
        <ol className="bp-info-list">
          <li>두 AI를 자식 프로세스로 실행 (<code>./player1</code>, <code>./player2</code>)</li>
          <li>게임 시작 전 초기 메시지 전송</li>
          <li>매 턴마다 현재 플레이어에게 상태 전송 → 행동을 받아 유효성 검사 → 상대에게 전달</li>
          <li>게임 종료 시 종료 신호 전송 후 결과를 stdout 마지막 줄에 출력</li>
        </ol>
        <div className="bp-tut-callout">
          <span><strong>핵심:</strong> Judge 실행 결과의 <strong>마지막 줄</strong>만 채점 서버가 읽습니다.</span>
        </div>

        {/* 3 */}
        <h4 className="bp-tut-h">3. Sample AI 코드란?</h4>
        <p className="bp-info-text">Sample AI는 참가자들이 참고하는 <strong>기본 AI 템플릿</strong>입니다.</p>
        <ul className="bp-info-list">
          <li>완전히 동작하는 AI여야 합니다 (게임을 끝까지 진행 가능해야 함)</li>
          <li>전략이 단순해도 괜찮습니다 (참가자들이 자신들의 코드를 개선하는 것이 목적)</li>
          <li>Judge와 동일한 통신 프로토콜을 따라야 합니다</li>
        </ul>

        {/* 4 */}
        <h4 className="bp-tut-h">4. 통신 프로토콜</h4>
        <h5 className="bp-tut-sub">유일한 규칙: stdin/stdout</h5>
        <p className="bp-info-text">
          Judge와 AI는 <strong>표준 입출력(stdin/stdout)</strong>으로만 통신합니다.
          그 외의 메시지 형식, 명령어 이름, 주고받는 순서는 <strong>개최자가 자유롭게 설계</strong>합니다.
        </p>
        <div className="bp-tut-callout">
          <span>디버그 메시지는 반드시 <strong>stderr</strong>에만 출력하세요. stdout에 쓰면 Judge가 오파싱합니다.</span>
        </div>
        <h5 className="bp-tut-sub">Judge 최종 출력 형식</h5>
        <p className="bp-info-text">Judge의 stdout <strong>마지막 줄</strong>은 반드시 <code>{"<P1_결과> <P2_결과>"}</code> 형식이어야 합니다.</p>
        <table className="bp-tut-table">
          <thead><tr><th>값</th><th>의미</th></tr></thead>
          <tbody>
            <tr><td><code>WIN</code></td><td>이겼음</td></tr>
            <tr><td><code>LOSE</code></td><td>졌음</td></tr>
            <tr><td><code>TIME_LIMIT</code></td><td>시간 초과</td></tr>
            <tr><td><code>MEMORY_LIMIT</code></td><td>메모리 초과</td></tr>
            <tr><td><code>RUNTIME_ERROR</code></td><td>게임 실행 중 잘못된 행동 또는 AI 프로세스 비정상 종료</td></tr>
            <tr><td><code>COMPILE_ERROR</code></td><td>AI 코드 컴파일 실패 (채점 서버가 설정, judge는 실행되지 않음)</td></tr>
            <tr><td><code>NONE</code></td><td>무승부</td></tr>
          </tbody>
        </table>
        <pre className="bp-tut-code">{`WIN LOSE              ← P1 승
LOSE WIN              ← P2 승
NONE NONE             ← 무승부
WIN TIME_LIMIT        ← P2 시간 초과로 P1 승
RUNTIME_ERROR WIN     ← P1 런타임 에러로 P2 승
WIN COMPILE_ERROR     ← P2 컴파일 에러로 P1 승`}</pre>
        <p className="bp-info-text">
          채점 서버는 이 마지막 줄을 파싱해서 <code>winner</code>를 결정합니다.
          P1=WIN이면 winner=1, P2=WIN이면 winner=2, 그 외는 winner=0(무효/무승부).
        </p>

        {/* 5 */}
        <h4 className="bp-tut-h">5. Judge 코드 작성법</h4>
        <p className="bp-info-text">구현해야 할 핵심 흐름입니다. <strong>각 항목을 클릭하면</strong> 아래 코드의 해당 부분으로 이동합니다.</p>
        <MonacoCodeGuide
          codeLabel="Judge 코드 뼈대 (C++) — 펼쳐보기"
          code={JUDGE_SKELETON_CPP}
          language="cpp"
          steps={[
            { text: "게임 보드/상태 초기화", start: 102, end: 108 },
            { text: "AI 프로세스 실행 (fork + pipe)", start: 34, end: 48 },
            { text: "게임 시작 시 초기 정보를 AI에게 전송 (형식은 자유)", start: 101, end: 108 },
            { text: "매 턴 또는 필요한 시점에 AI와 데이터 주고받기 (형식·순서는 자유)", start: 116, end: 142 },
            { text: "각 AI의 행동 유효성 검사", start: 131, end: 133 },
            { text: <>타임아웃 처리 (AI가 응답하지 않을 경우 <code>TIME_LIMIT</code>)</>, start: 126, end: 129 },
            { text: "게임 종료 조건 판단 후 AI에 종료 신호 전송", start: 144, end: 149 },
            { text: "마지막 줄에 결과 출력 (이것만 채점 서버가 읽음)", start: 155, end: 158 },
          ]}
        />

        {/* 6 */}
        <h4 className="bp-tut-h">6. Sample AI 코드 작성법</h4>
        <p className="bp-info-text">
          Sample AI가 처리해야 할 명령어는 <strong>개최자가 Judge에서 정의한 프로토콜</strong>을 그대로 따릅니다.
          AI가 해야 할 일은 세 가지입니다.
        </p>
        <ol className="bp-info-list">
          <li>Judge에서 보내는 메시지를 stdin으로 읽는다</li>
          <li>행동을 요청하는 메시지에 대해서만 stdout으로 응답한다</li>
          <li>게임 종료 신호를 받으면 프로그램을 정상 종료한다</li>
        </ol>
        <div className="bp-tut-callout">
          <span><strong>핵심 주의:</strong> 행동을 출력할 때는 반드시 <code>endl</code> / <code>flush</code>로 즉시 전송해야 합니다.
          버퍼에 남아있으면 Judge가 응답을 기다리다 타임아웃 처리됩니다.</span>
        </div>
        <p className="bp-info-text">명령어 이름과 데이터 형식은 Judge가 정의한 프로토콜에 맞게 수정하세요.</p>
        <MonacoSampleGuide
          codeLabel="Sample AI 뼈대 — 언어 선택 후 펼쳐보기"
          codes={{ cpp: SAMPLE_CODE_CPP, java: SAMPLE_CODE_JAVA, python: SAMPLE_CODE_PYTHON }}
        />

        {/* 7 */}
        <h4 className="bp-tut-h">7. 완성된 예시 — 사과 게임</h4>
        <h5 className="bp-tut-sub">게임 규칙</h5>
        <ul className="bp-info-list">
          <li><strong>보드</strong>: 10행 × 17열, 각 칸에 1~9 숫자</li>
          <li><strong>행동</strong>: 직사각형 영역 <code>(r1, c1) ~ (r2, c2)</code> 선택, 영역 내 합이 정확히 <strong>10</strong>이어야 하며 네 변에 각각 숫자가 1개 이상 포함</li>
          <li><strong>패스</strong>: <code>-1 -1 -1 -1</code> 출력</li>
          <li><strong>종료</strong>: 양쪽이 연속으로 패스하면 게임 종료</li>
          <li><strong>승자</strong>: 더 많은 칸을 소유한 플레이어가 승리</li>
        </ul>
        <p className="bp-info-text">사과 게임 프로토콜: <code>READY</code> → <code>INIT</code> → (<code>TIME</code> → <code>OPP</code>) 반복 → <code>FINISH</code></p>
        <h5 className="bp-tut-sub">대회 제출 시 첨부 파일</h5>
        <table className="bp-tut-table">
          <thead><tr><th>파일</th><th>설명</th><th>비고</th></tr></thead>
          <tbody>
            <tr><td><code>judge.cpp</code></td><td>게임 심판 코드</td><td>참가자에게 비공개</td></tr>
            <tr><td><code>sample_code.cpp</code></td><td>기본 AI 예시</td><td>참가자에게 공개됨</td></tr>
          </tbody>
        </table>

        {/* 8 */}
        <h4 className="bp-tut-h">8. 시각화 HTML 제출하기 (선택)</h4>
        <h5 className="bp-tut-sub">로그 시각화 HTML (대결 리플레이)</h5>
        <p className="bp-info-text">
          Judge가 출력한 로그 파일을 업로드하면 대결을 턴별로 재생하는 뷰어입니다.
          슬라이더 · 재생(0.5×~16×) · 힌트 · 키보드 단축키(<code>←</code> <code>→</code> <code>Space</code>)를 지원합니다.
          Judge가 <code>INIT</code> / <code>FIRST</code> / <code>SECOND</code> / 마지막 <code>WIN LOSE</code> 형식으로 로그를 출력해야 합니다.
        </p>
        <h5 className="bp-tut-sub">혼자 플레이 HTML (게임 직접 체험)</h5>
        <p className="bp-info-text">
          참가자가 AI를 만들기 전 게임 규칙을 직접 체험하는 인터랙티브 플레이어입니다.
          마우스 드래그 선택 · 실시간 합계 피드백 · 힌트 · 모바일 터치를 지원합니다.
        </p>
        <div className="bp-tut-callout">
          <span>시각화 HTML은 <strong>독립 실행 가능한 단일 파일</strong>이어야 합니다. iframe 삽입 시 <code>window.postMessage</code>(<code>{"{ type: \"LOAD_LOG\", log }"}</code>)로 로그를 전달받을 수 있습니다.</span>
        </div>

        {/* 9 */}
        <h4 className="bp-tut-h">9. 제출 전 체크리스트</h4>
        <h5 className="bp-tut-sub">Judge 코드</h5>
        <ul className="bp-tut-check">
          <li><code>./judge ./player1 ./player2</code> 형태로 실행 가능한가?</li>
          <li>마지막 stdout 줄이 <code>{"<P1결과> <P2결과>"}</code> 형식인가? (<code>WIN LOSE</code> 등)</li>
          <li>타임아웃 처리가 있는가? (AI가 무응답 시 <code>TIME_LIMIT</code> 처리)</li>
          <li>잘못된 행동(유효하지 않은 수) 처리가 있는가?</li>
          <li>두 플레이어가 모두 NONE일 때(무승부) 처리가 있는가?</li>
        </ul>
        <h5 className="bp-tut-sub">Sample AI 코드</h5>
        <ul className="bp-tut-check">
          <li>행동 요청 시 유효한 행동을 출력하는가?</li>
          <li>모든 출력에 <code>endl</code>/<code>flush</code>가 있는가?</li>
          <li>종료 신호 수신 시 정상 종료하는가?</li>
          <li>디버그 메시지를 <code>stderr</code>에만 출력하는가? (<code>cerr</code> / <code>sys.stderr</code>)</li>
          <li>Judge가 설정한 타임아웃 내에 항상 응답하는가?</li>
        </ul>
        <h5 className="bp-tut-sub">공통</h5>
        <ul className="bp-tut-check">
          <li>C++ 기준 <code>g++ -O2</code>로 컴파일 오류 없이 빌드되는가?</li>
          <li>Judge와 Sample AI를 로컬에서 직접 실행해 정상 동작을 확인했는가?</li>
        </ul>
        <h5 className="bp-tut-sub">시각화 HTML (제출하는 경우)</h5>
        <ul className="bp-tut-check">
          <li><strong>로그 시각화 HTML</strong>: Judge 출력 로그를 업로드했을 때 보드가 정상 렌더링되는가?</li>
          <li><strong>로그 시각화 HTML</strong>: 슬라이더, 재생, 힌트 버튼이 정상 동작하는가?</li>
          <li><strong>혼자 플레이 HTML</strong>: 브라우저에서 열었을 때 보드가 바로 표시되는가?</li>
          <li><strong>혼자 플레이 HTML</strong>: 마우스 드래그로 선택 → 합 피드백 → 확정이 정상 동작하는가?</li>
        </ul>

        <div className="bp-tut-cta">
          <p className="bp-tut-cta-text">설명을 다 읽으셨나요? 이제 직접 따라하며 대회를 개최해보세요.</p>
          <button
            className="bp-tut-cta-btn"
            onClick={() => { window.location.hash = "tutorial-contest"; }}
          >
            직접 개최해보기
          </button>
        </div>
      </>
    ),
  },
];

const STATUS_LABEL: Record<string, string> = {
  RUNNING:  "개최 중",
  PLANNED:  "개최 예정",
  END:      "종료",
  CANCELED: "종료",
  TEST:     "TEST",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function statusCardClass(status?: string): string {
  if (status === "RUNNING")  return " bp-problem-card--running";
  if (status === "PLANNED")  return " bp-problem-card--planned";
  if (status === "END")      return " bp-problem-card--ended";
  if (status === "CANCELED") return " bp-problem-card--ended";
  if (status === "TEST")     return " bp-problem-card--test";
  return "";
}


function getTabFromHash(): BattleTab {
  const parts = window.location.hash.replace("#", "").split("/");
  const tab = parts[1] as BattleTab;
  return VALID_BATTLE_TABS.includes(tab) ? tab : "contest";
}

const BattlePage: React.FC = () => {
  const { user, logout, navigate, joinedContestIds, hostedContestIds, createdContestIds } = useApp();
  const [activeTab, setActiveTab] = useState<BattleTab>(getTabFromHash);
  const [expandedHelp, setExpandedHelp] = useState<number | null>(null);

  // 대회 목록 상태
  const [contests, setContests] = useState<ContestItem[]>([]);
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState<string | null>(null);
  // 대회 개최 비용 안내 팝업
  const [showCostPopup, setShowCostPopup] = useState(false);

  // 약관 동의 모달
  const [showTermsModal, setShowTermsModal] = useState(false);

  // 필터 상태
  const [filterStatus, setFilterStatus]       = useState<StatusFilter>("");
  const [filterName,   setFilterName]         = useState("");
  const [filterStartFrom, setFilterStartFrom] = useState("");
  const [filterEndTo,     setFilterEndTo]     = useState("");

  const hasFilters = !!(filterStatus || filterName || filterStartFrom || filterEndTo);

  const resetFilters = () => {
    setFilterStatus("");
    setFilterName("");
    setFilterStartFrom("");
    setFilterEndTo("");
  };

  useEffect(() => {
    const handleHashChange = () => {
      const parts = window.location.hash.replace("#", "").split("/");
      if (parts[0] === "battle" && parts[1]) {
        const tab = parts[1] as BattleTab;
        if (VALID_BATTLE_TABS.includes(tab)) setActiveTab(tab);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tab: BattleTab) => {
    window.location.hash = `battle/${tab}`;
    setActiveTab(tab);
    if (tab !== "help") setExpandedHelp(null);
  };

  const fetchContests = useCallback(async () => {
    setContestLoading(true);
    setContestError(null);
    try {
      const data = await getContestList(0, FETCH_SIZE, ["id,desc"]);
      setContests(data.content);
    } catch {
      setContestError("대회 목록을 불러오지 못했습니다.");
    } finally {
      setContestLoading(false);
    }
  }, []);

  useEffect(() => {
    // 대회 목록은 '대회' 탭과 '이전 문제' 탭 둘 다에서 사용 → 둘 다일 때 로딩
    if (activeTab === "contest" || activeTab === "previous-problems") fetchContests();
  }, [activeTab, fetchContests]);

  function sortPriority(c: ContestItem): number {
    const isHosted = hostedContestIds.includes(c.id);
    const isJoined = joinedContestIds.includes(c.id);
    switch (c.status) {
      case "RUNNING":  return isHosted ? 0 : isJoined ? 1 : 2;
      case "PLANNED":  return isHosted ? 3 : isJoined ? 4 : 5;
      case "END":      return isHosted ? 6 : isJoined ? 7 : 8;
      case "TEST":     return 9;
      case "CANCELED": return isHosted ? 10 : isJoined ? 11 : 12;
      default:         return 8;
    }
  }

  // 이전 문제: 종료된 지 3일 이상 지난 대회
  function isPreviousProblem(c: ContestItem): boolean {
    if (c.status !== "END" && c.status !== "CANCELED") return false;
    const endDate = new Date(c.endDate || 0);
    const now = new Date();
    const daysSinceEnd = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceEnd >= 3;
  }

  // 현재 대회 탭: 3일 미만 종료 또는 계획/진행 중
  function isCurrentProblem(c: ContestItem): boolean {
    if (c.status === "RUNNING" || c.status === "PLANNED" || c.status === "TEST") return true;
    if (c.status === "END" || c.status === "CANCELED") {
      const endDate = new Date(c.endDate || 0);
      const now = new Date();
      const daysSinceEnd = Math.floor((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceEnd < 3;
    }
    return false;
  }

  // 참여 여부 확인 (참가자, 검수자, 개최자 모두 참여로 간주)
  function isParticipant(contestId: number): boolean {
    return joinedContestIds.includes(contestId) ||
           hostedContestIds.includes(contestId) ||
           createdContestIds.includes(contestId);
  }

  // 현재 대회 탭에 표시할 대회들
  const currentProblems = contests.filter(isCurrentProblem);

  // 이전 문제 탭에 표시할 대회들
  const previousProblems = contests.filter(isPreviousProblem).sort((a, b) => a.id - b.id);

  // 최근 1일 이내 종료된 참가 대회
  const recentEndedContests = currentProblems.filter(c =>
    (c.status === "END" || c.status === "CANCELED") &&
    joinedContestIds.includes(c.id) &&
    c.endDate &&
    (() => {
      const diff = Date.now() - new Date(c.endDate!).getTime();
      return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
    })()
  );

  // 필터 + 우선순위 정렬 (현재 대회 탭용)
  const filteredContests = [...currentProblems]
    .sort((a, b) => sortPriority(a) - sortPriority(b))
    .filter(c => {
      if (filterStatus && c.status !== filterStatus) return false;
      if (filterName && !c.title.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterStartFrom && c.startDate) {
        if (new Date(c.startDate) < new Date(filterStartFrom)) return false;
      }
      if (filterEndTo && c.endDate) {
        const to = new Date(filterEndTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(c.endDate) > to) return false;
      }
      return true;
    });

  return (
    <div className="home-page battle-home-page">
      {/* ── 약관 동의 모달 ── */}
      <TermsAgreementModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAgree={() => {
          setShowTermsModal(false);
          navigate("create-contest");
        }}
        type="contest-hosting"
      />

      {/* ── 대회 개최 비용 안내 팝업 ── */}
      {showCostPopup && (
        <div className="bp-popup-overlay" onClick={() => setShowCostPopup(false)}>
          <div className="bp-popup bp-cost-popup" onClick={e => e.stopPropagation()}>
            <p className="bp-popup-msg">대회 개최 비용 안내</p>
            <div className="bp-cost-table">
              <div className="bp-cost-row">
                <span className="bp-cost-type bp-cost-type--uncert">비인증 대회</span>
                <span className="bp-cost-price">10,000원</span>
              </div>
              <div className="bp-cost-row">
                <span className="bp-cost-type bp-cost-type--cert">인증 대회</span>
                <span className="bp-cost-price bp-cost-price--cert">100,000원</span>
              </div>
            </div>
            <p className="bp-cost-note">
              대회 생성 완료 시 해당 금액이 결제됩니다.<br />
              인증/비인증은 다음 페이지에서 선택하실 수 있습니다.
            </p>
            <button className="bp-popup-btn" onClick={() => { setShowCostPopup(false); setShowTermsModal(true); }}>
              확인 — 약관 동의하기
            </button>
          </div>
        </div>
      )}

      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
        </span>
        <nav className="home-tab-nav">
          <button
            className={`home-tab-btn${activeTab === "contest" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("contest")}
          >
            대회
          </button>
          <button
            className={`home-tab-btn${activeTab === "previous-problems" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("previous-problems")}
          >
            이전 문제
          </button>
          <button
            className={`home-tab-btn${activeTab === "help" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("help")}
          >
            도움말
          </button>
          <button
            className={`home-tab-btn${activeTab === "contact" ? " home-tab-btn--active" : ""}`}
            onClick={() => handleTabChange("contact")}
          >
            문의
          </button>
        </nav>
        <div className="home-auth-area">
          {user ? (
            <>
              <ProfileBadge />
              <button className="btn btn-ghost btn-sm" onClick={() => logout()}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("signup")}>회원가입</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                localStorage.setItem("loginRedirect", window.location.hash.replace("#", "") || "battle");
                navigate("login");
              }}>로그인</button>
            </>
          )}
        </div>
        <ResponsiveNavMenu tabs={[
          { label: "대회",      onClick: () => handleTabChange("contest"),           active: activeTab === "contest" },
          { label: "이전 문제", onClick: () => handleTabChange("previous-problems"), active: activeTab === "previous-problems" },
          { label: "도움말",    onClick: () => handleTabChange("help"),              active: activeTab === "help" },
          { label: "문의",      onClick: () => handleTabChange("contact"),           active: activeTab === "contact" },
        ]} />
      </header>

      <main className="home-body">
        {/* 대회 탭 */}
        {activeTab === "contest" && (
          <div className="bp-contest">
            {recentEndedContests.length > 0 && (
              <div className="bp-result-notify">
                {/* 좌측: 안내 텍스트 */}
                <div className="bp-result-notify-left">
                  <span className="bp-result-notify-dot" />
                  <div className="bp-result-notify-content">
                    <span className="bp-result-notify-headline">
                      최근 참가하신 대회가 종료되었습니다.
                      <span className="bp-result-notify-arrow">→</span>
                    </span>
                    <span className="bp-result-notify-sub">클릭하여 최종 결과를 확인하세요.</span>
                  </div>
                </div>

                {/* 우측: 대회 미니 카드 (클릭 영역) */}
                <div className="bp-result-notify-cards">
                  {recentEndedContests.map(c => (
                    <button
                      key={c.id}
                      className="bp-result-mini-card"
                      onClick={() => { window.location.hash = `submit/${c.id}/final-result`; }}
                    >
                      <div className="bp-result-mini-left">
                        <p className="bp-result-mini-title">
                          {c.title}
                          {joinedContestIds.includes(c.id) && (
                            <span className="bp-contest-badge bp-contest-badge--joined">참가</span>
                          )}
                          {hostedContestIds.includes(c.id) && (
                            <span className="bp-contest-badge bp-contest-badge--hosted">검수</span>
                          )}
                          {createdContestIds.includes(c.id) && (
                            <span className="bp-contest-badge bp-contest-badge--created">개최</span>
                          )}
                        </p>
                        {(c.startDate || c.endDate) && (
                          <p className="bp-result-mini-dates">
                            <span>기간: </span>
                            {c.startDate && <span>{formatDate(c.startDate)}</span>}
                            {c.startDate && c.endDate && <span>~</span>}
                            {c.endDate && <span>{formatDate(c.endDate)}</span>}
                          </p>
                        )}
                      </div>
                      <div className="bp-result-mini-right">
                        {c.status === "CANCELED" && (
                          <span className="bp-canceled-warn" title="참가자 수 부족으로 최종 결과가 집계되지 않았습니다">!</span>
                        )}
                        <span className="bp-problem-difficulty bp-problem-difficulty--ended">종료</span>
                        <span className="bp-problem-arrow">›</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <a
              href="/softcon.html"
              target="_blank"
              rel="noopener noreferrer"
              className="bp-softcon-btn"
            >
              소프트콘 페이지
            </a>

            <div className="bp-contest-header">
              <h2 className="bp-contest-title">대회 목록</h2>
              <button className="bp-create-contest-btn" onClick={() => setShowCostPopup(true)}>
                + 대회 개최
              </button>
            </div>

            {/* ── 필터 바 ── */}
            <div className="bp-filter-bar">
              <select
                className="bp-filter-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as StatusFilter)}
              >
                <option value="">전체</option>
                <option value="RUNNING">개최 중</option>
                <option value="PLANNED">개최 예정</option>
                <option value="END">종료</option>
              </select>

              <input
                className="bp-filter-input"
                type="text"
                placeholder="대회명 검색"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />

              <div className="bp-filter-date-group">
                <label className="bp-filter-date-label">시작일</label>
                <input
                  className="bp-filter-date"
                  type="date"
                  value={filterStartFrom}
                  onChange={e => setFilterStartFrom(e.target.value)}
                />
                <span className="bp-filter-date-sep">~</span>
                <label className="bp-filter-date-label">종료일</label>
                <input
                  className="bp-filter-date"
                  type="date"
                  value={filterEndTo}
                  onChange={e => setFilterEndTo(e.target.value)}
                />
              </div>

              {hasFilters && (
                <button className="bp-filter-reset" onClick={resetFilters}>초기화</button>
              )}
            </div>

            {contestLoading && (
              <div className="bp-contest-empty">
                <span className="bp-contest-empty-text">불러오는 중...</span>
              </div>
            )}

            {contestError && (
              <div className="bp-contest-empty">
                <span className="bp-contest-empty-text" style={{ color: "#dc2626" }}>{contestError}</span>
              </div>
            )}

            {!contestLoading && !contestError && (
              <>
                {filteredContests.length === 0 ? (
                  <div className="bp-contest-empty">
                    <span className="bp-contest-empty-text">
                      {hasFilters ? "조건에 맞는 대회가 없습니다." : "아직 등록된 대회가 없습니다."}
                    </span>
                  </div>
                ) : (
                  <>
                    <p className="bp-filter-count">총 {filteredContests.length}개 대회</p>
                    <div className="bp-problem-list">
                      {filteredContests.map((c, idx) => (
                        <div
                          key={c.id}
                          className={`bp-problem-card${statusCardClass(c.status)}`}
                          onClick={() => {
                            window.location.hash = `submit/${c.id}`;
                          }}
                        >
                          <div className="bp-problem-card-left">
                            {createdContestIds.includes(c.id) && (c.status === "PLANNED" || c.status === "RUNNING") && (
                              <button
                                className="bp-settings-btn"
                                title="대회 설정"
                                onClick={e => {
                                  e.stopPropagation();
                                  window.location.hash = `contest-settings/${c.id}`;
                                }}
                              >
                                <img src="/resources/settings.svg" alt="설정" className="bp-settings-icon" />
                              </button>
                            )}
                            <div className="bp-problem-info">
                              <span className="bp-problem-num">#{idx + 1}</span>
                              <p className="bp-problem-title">
                                {c.title}
                                {joinedContestIds.includes(c.id) && (
                                  <span className="bp-contest-badge bp-contest-badge--joined">
                                    {(c.status === "END" || c.status === "CANCELED") ? "참가" : "참가중"}
                                  </span>
                                )}
                                {hostedContestIds.includes(c.id) && (
                                  <span className="bp-contest-badge bp-contest-badge--hosted">
                                    {(c.status === "END" || c.status === "CANCELED") ? "검수" : "검수중"}
                                  </span>
                                )}
                                {createdContestIds.includes(c.id) && (
                                  <span className="bp-contest-badge bp-contest-badge--created">개최</span>
                                )}
                              </p>
                              {(c.startDate || c.endDate) && (
                                <p className="bp-problem-dates">
                                  <span className="bp-problem-dates-label"><strong>기간</strong> :</span>
                                  {c.startDate && <span>{formatDate(c.startDate)}</span>}
                                  {c.startDate && c.endDate && <span className="bp-problem-dates-sep">~</span>}
                                  {c.endDate && <span>{formatDate(c.endDate)}</span>}
                                </p>
                              )}

                            </div>
                          </div>
                          <div className="bp-problem-card-right">
                            {c.status && (
                              <div className="bp-status-area">
                                {c.status === "CANCELED" && (
                                  <span
                                    className="bp-canceled-warn"
                                    title="참가자 수 부족으로 최종 결과가 집계되지 않았습니다"
                                  >!</span>
                                )}
                                <span className={`bp-problem-difficulty${
                                  c.status === "TEST"                ? " bp-problem-difficulty--test"    :
                                  c.status === "PLANNED"             ? " bp-problem-difficulty--planned" :
                                  c.status === "RUNNING"             ? " bp-problem-difficulty--running" :
                                  c.status === "END" ||
                                  c.status === "CANCELED"            ? " bp-problem-difficulty--ended"   : ""
                                }`}>
                                  {c.status === "RUNNING" && <span className="bp-status-dot" />}
                                  {STATUS_LABEL[c.status] ?? c.status}
                                </span>
                              </div>
                            )}
                            <span className="bp-problem-arrow">→</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* 이전 문제 탭 */}
        {activeTab === "previous-problems" && (
          <div className="bp-previous-problems">
            <div className="bp-previous-header">
              <h2 className="bp-previous-title">이전 문제</h2>
              <p className="bp-previous-subtitle">지난 3일 이상 종료된 대회들</p>
            </div>

            {previousProblems.length === 0 ? (
              <div className="bp-contest-empty">
                <span className="bp-contest-empty-text">이전 문제가 없습니다.</span>
              </div>
            ) : (
              <div className="bp-previous-table-wrap">
                <table className="bp-previous-table">
                  <thead>
                    <tr>
                      <th className="bp-prev-th-id">ID</th>
                      <th className="bp-prev-th-name">이름</th>
                      <th className="bp-prev-th-info">정보</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previousProblems.map((c, idx) => (
                      <tr key={c.id} className="bp-prev-row" onClick={() => { window.location.hash = `submit/${c.id}`; }}>
                        <td className="bp-prev-id">#{idx + 1}</td>
                        <td className="bp-prev-name">{c.title}</td>
                        <td className="bp-prev-info">
                          {isParticipant(c.id) ? (
                            <span className="bp-prev-participated">참여</span>
                          ) : (
                            <span className="bp-prev-not-participated">미참여</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 도움말 탭 */}
        {activeTab === "help" && (
          <div className="bp-help-page">
            <div className="bp-help-layout">
              {/* 좌측 목록 */}
              <nav className="bp-help-nav">
                <div className="bp-help-nav-heading">도움말</div>
                {HELP_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    className={`bp-help-nav-item${expandedHelp === i ? " bp-help-nav-item--active" : ""}`}
                    onClick={() => setExpandedHelp(expandedHelp === i ? null : i)}
                  >
                    <span className="bp-help-nav-num">{String(i + 1).padStart(2, "0")}</span>
                    <div className="bp-help-nav-text">
                      <span className="bp-help-nav-label">
                        {item.title}
                        {item.hasTutorial && (
                          <span className="bp-tutorial-badge" title="따라하기 튜토리얼 제공">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            튜토리얼
                          </span>
                        )}
                      </span>
                      <span className="bp-help-nav-desc">{item.summary}</span>
                    </div>
                    <span className="bp-help-nav-arrow">›</span>
                  </button>
                ))}
              </nav>
              {/* 우측 상세 */}
              <div className="bp-help-detail-wrap">
                {expandedHelp !== null ? (
                  <div key={expandedHelp} className="bp-help-detail">
                    <div className="bp-help-detail-header">
                      <span className="bp-help-detail-num">{String(expandedHelp + 1).padStart(2, "0")}</span>
                      <h3 className="bp-help-detail-title">{HELP_ITEMS[expandedHelp].title}</h3>
                      {HELP_ITEMS[expandedHelp].hasTutorial && (
                        <span className="bp-tutorial-badge bp-tutorial-badge--lg" title="따라하기 튜토리얼 제공">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          튜토리얼
                        </span>
                      )}
                    </div>
                    <div className="bp-help-detail-body">{HELP_ITEMS[expandedHelp].body}</div>
                  </div>
                ) : (
                  <div className="bp-help-detail-empty">
                    좌측 목록에서 항목을 선택하면 자세한 내용이 표시됩니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 문의 탭 */}
        {activeTab === "contact" && (
          <div className="bp-info-page">
            <h2 className="bp-info-title">문의</h2>

            <section className="bp-info-section">
              <h3 className="bp-info-section-title">개발팀 연락처</h3>
              <p className="bp-info-text">
                버그 제보, 기능 제안, 대회 개설 문의는 아래 채널로 연락해 주세요.
              </p>
              <div className="bp-contact-cards">
                <div className="bp-contact-card">
                  <span className="bp-contact-icon">✉</span>
                  <div>
                    <div className="bp-contact-label">이메일</div>
                    <div className="bp-contact-value">ajs8780@ajou.ac.kr</div>
                  </div>
                </div>
                <div className="bp-contact-card">
                  <span className="bp-contact-icon">🏫</span>
                  <div>
                    <div className="bp-contact-label">소속</div>
                    <div className="bp-contact-value">아주대학교 소프트웨어학과 캡스톤 프로젝트</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bp-info-section">
              <h3 className="bp-info-section-title">버그 리포트 시 포함 사항</h3>
              <ol className="bp-info-list">
                <li>발생한 페이지 및 탭 이름</li>
                <li>재현 방법 (어떤 동작을 했는지)</li>
                <li>브라우저 개발자 도구 콘솔 오류 메시지 (있는 경우)</li>
                <li>스크린샷 또는 화면 녹화</li>
              </ol>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default BattlePage;
