import React, { useState, useRef, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { reviewContest } from "../api/codeBattleApi";
import { setTestResultCallback } from "../api/sseApi";
import { useApp } from "../context/AppContext";
import { Language } from "../types/index";
import "./ReviewTab.css";

const LANGUAGE_OPTIONS: { label: string; value: Language }[] = [
  { label: "C++",    value: "cpp"    },
  { label: "Java",   value: "java"   },
  { label: "Python", value: "python" },
];

const CODE_DEFAULTS: Record<Language, string> = {
  cpp:    "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n",
  java:   "public class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n",
  python: "def solution():\n    pass\n",
};

const TIMEOUT_SEC = 60;

interface Props {
  contestId: number;
}

const ReviewTab: React.FC<Props> = ({ contestId }) => {
  const { user } = useApp();
  const [lang1, setLang1] = useState<Language>("python");
  const [code1, setCode1] = useState(CODE_DEFAULTS["python"]);
  const [lang2, setLang2] = useState<Language>("python");
  const [code2, setCode2] = useState(CODE_DEFAULTS["python"]);

  const [phase, setPhase]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [log, setLog]         = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(TIMEOUT_SEC);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  // 언마운트 시 SSE 콜백 해제
  useEffect(() => () => { setTestResultCallback(null); }, []);

  const handleLangChange = (side: 1 | 2, lang: Language) => {
    if (side === 1) { setLang1(lang); setCode1(CODE_DEFAULTS[lang]); }
    else            { setLang2(lang); setCode2(CODE_DEFAULTS[lang]); }
  };

  const handleSubmit = useCallback(async () => {
    if (phase === "loading") return;
    setPhase("loading");
    setLog("");
    setErrorMsg("");
    setCountdown(TIMEOUT_SEC);

    const controller = new AbortController();
    abortRef.current = controller;

    let remaining = TIMEOUT_SEC;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearTimer();
        setTestResultCallback(null);
        setErrorMsg("채점 시간이 초과되었습니다. (60초)");
        setPhase("error");
      }
    }, 1000);

    // SSE test_result 수신 시 결과 반영
    setTestResultCallback((logData: string) => {
      clearTimer();
      setTestResultCallback(null);
      setLog(logData);
      setPhase("done");
    });

    try {
      await reviewContest(
        String(user?.id ?? ""),
        String(contestId),
        code1,
        code2,
        controller.signal
      );
      // POST 성공 — SSE로 결과 대기 중
    } catch (err: any) {
      clearTimer();
      setTestResultCallback(null);
      if (err.name === "AbortError" || err.name === "CanceledError") {
        setErrorMsg("채점 시간이 초과되었습니다. (60초)");
      } else if (err.response) {
        setErrorMsg(`[${err.response.status}] ${err.response.data?.message ?? err.response.statusText}`);
      } else {
        setErrorMsg(err.message ?? "서버에 연결할 수 없습니다.");
      }
      setPhase("error");
    }
  }, [contestId, code1, lang1, code2, lang2, phase, user]);

  const handleCancel = () => {
    abortRef.current?.abort();
    setTestResultCallback(null);
    clearTimer();
    setPhase("idle");
    setCountdown(TIMEOUT_SEC);
  };

  const handleReset = () => {
    setPhase("idle");
    setLog("");
    setErrorMsg("");
    setCountdown(TIMEOUT_SEC);
  };

  const isLoading = phase === "loading";

  return (
    <div className="rv-root">

      {/* ── 두 에디터 ── */}
      <div className="rv-editors">

        {/* 에디터 1 */}
        <div className="rv-editor-panel">
          <div className="rv-editor-header">
            <span className="rv-editor-label">AI 코드 1</span>
            <select
              className="rv-lang-select"
              value={lang1}
              disabled={isLoading}
              onChange={e => handleLangChange(1, e.target.value as Language)}
            >
              {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="rv-editor-body">
            <Editor
              height="100%"
              language={lang1}
              value={code1}
              onChange={v => setCode1(v ?? "")}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 4,
                automaticLayout: true,
                readOnly: isLoading,
              }}
            />
          </div>
        </div>

        {/* VS 구분선 */}
        <div className="rv-vs-col">
          <div className="rv-vs-line" />
          <span className="rv-vs-label">VS</span>
          <div className="rv-vs-line" />
        </div>

        {/* 에디터 2 */}
        <div className="rv-editor-panel">
          <div className="rv-editor-header rv-editor-header--right">
            <select
              className="rv-lang-select"
              value={lang2}
              disabled={isLoading}
              onChange={e => handleLangChange(2, e.target.value as Language)}
            >
              {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <span className="rv-editor-label">AI 코드 2</span>
          </div>
          <div className="rv-editor-body">
            <Editor
              height="100%"
              language={lang2}
              value={code2}
              onChange={v => setCode2(v ?? "")}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 4,
                automaticLayout: true,
                readOnly: isLoading,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── 액션 바 ── */}
      <div className="rv-action-bar">
        {isLoading ? (
          <div className="rv-loading-row">
            <span className="rv-spinner" />
            <span className="rv-loading-text">
              채점 중... <strong>{countdown}초</strong> 남음
            </span>
            <button className="rv-cancel-btn" onClick={handleCancel}>취소</button>
          </div>
        ) : (
          <button className="rv-submit-btn" onClick={handleSubmit}>
            ▶ 대결 시작
          </button>
        )}
        {phase === "error" && (
          <span className="rv-error-msg">{errorMsg}</span>
        )}
      </div>

      {/* ── 결과 로그 ── */}
      {phase === "done" && (
        <div className="rv-log-panel">
          <div className="rv-log-header">
            <span className="rv-log-title">채점 결과 로그</span>
            <button className="rv-log-reset" onClick={handleReset}>다시 검수하기</button>
          </div>
          <pre className="rv-log-body">{log}</pre>
        </div>
      )}

    </div>
  );
};

export default ReviewTab;
