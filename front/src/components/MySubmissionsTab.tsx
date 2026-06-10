import React, { useState, useEffect, useCallback, useRef } from "react";
import { LocalSubmission } from "../pages/BattleSubmitPage";
import { BattleMatchResult, SseStatus, getSseStatus, setStatusCallback } from "../api/sseApi";
import { getMyBattleSubmissions, ContestSubmissionResponse, getSubmissionCode, SubmissionCode, selectSubmissionCode, getMySelectedSubmission } from "../api/codeBattleApi";
import Editor from "@monaco-editor/react";
import "./MySubmissionsTab.css";

// 서버 language 문자열 → Monaco 언어 ID
function toMonacoLang(lang: string): string {
  const l = (lang ?? "").toLowerCase();
  if (l === "cpp" || l === "c++") return "cpp";
  if (l === "java")               return "java";
  if (l === "python" || l === "py") return "python";
  return "plaintext";
}

interface Props {
  contestId: number;
  refreshKey: number;
  localSubmissions: LocalSubmission[];
  onLocalUpdate: React.Dispatch<React.SetStateAction<LocalSubmission[]>>;
  onLogClick: (log: string) => void;
  userId: string;
  hasVisualization?: boolean;
}

type SortOrder = "newest" | "oldest";


// 로그 마지막 줄의 결과 형식(예: "WIN LOSE") → 내(왼쪽) 결과 원본 값/스타일
function parseMyResult(log: string): { label: string; cls: string } {
  const lines  = (log ?? "").trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const last   = lines[lines.length - 1] ?? "";
  const tokens = last.split(/\s+/).map(t => t.toUpperCase());
  const left   = tokens[0] ?? "";
  const right  = tokens[1] ?? "";
  // 양쪽 모두 WIN이면 무승부(NONE)로 처리
  const result = left === "WIN" && right === "WIN" ? "NONE" : left;
  const label  = result || "-"; // 로그 원본 값 그대로 (WIN, LOSE, TIME_LIMIT 등)
  const cls =
    result === "WIN"  ? "ms-winner--me"   :
    result === "NONE" ? "ms-winner--draw" :
    "ms-winner--ai"; // LOSE / TIME_LIMIT / MEMORY_LIMIT / RUNTIME_ERROR / COMPILE_ERROR
  return { label, cls };
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? parseServerDate(d) : d;
  return date.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function parseServerDate(s: string): Date {
  if (!s) return new Date(NaN);
  // 서버가 UTC를 타임존 표시 없이 보냄 → Z 추가해 UTC로 명시적 파싱
  if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  return new Date(s + "Z");
}

// 동일 submissionId를 가진 항목 그룹을 하나의 LocalSubmission으로 변환
function serverGroupToLocal(group: ContestSubmissionResponse[], userId: string): LocalSubmission {
  // 가장 오래된 항목의 시간을 제출 시간으로 사용
  const sorted = [...group].sort((a, b) => parseServerDate(a.createdAt).getTime() - parseServerDate(b.createdAt).getTime());
  const first = sorted[0];

  const matchMap = new Map<number, BattleMatchResult>();
  for (const item of group) {
    const { aiId, status, log } = item.result;
    if (!log || !log.trim()) continue;
    if (matchMap.has(aiId)) continue; // 같은 aiId 중복 제거
    const winner = status === "WIN" ? userId : status === "DRAW" ? "draw" : "ai";
    matchMap.set(aiId, { matchId: aiId, winner, log });
  }
  const matches: BattleMatchResult[] = Array.from(matchMap.values());

  const uniqueAiCount = new Set(group.map(item => item.result.aiId)).size;
  const allComplete = matchMap.size === uniqueAiCount && uniqueAiCount > 0;
  const wins   = matches.filter(m => m.winner === userId).length;
  const losses = matches.filter(m => m.winner !== userId && m.winner !== "draw").length;

  return {
    submissionId: first.submissionId,
    submittedAt:  parseServerDate(first.createdAt),
    language: "",
    success:  true,
    message:  "",
    wins:    allComplete ? wins   : undefined,
    losses:  allComplete ? losses : undefined,
    matches,
    finalized: allComplete,
  };
}

// ── 매치 상세 행 ──
function MatchRow({ match, index, hasVisualization, onLogClick, codeOpen, canShowCode, onCodeToggle }: {
  match: BattleMatchResult;
  index: number;
  userId: string;
  hasVisualization: boolean;
  onLogClick: (log: string) => void;
  codeOpen: boolean;
  canShowCode: boolean;
  onCodeToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { label, cls }  = parseMyResult(match.log);
  const hasLog          = !!match.log?.trim();

  return (
    <>
      <tr className="ms-match-row">
        <td className="ms-match-num">#{index + 1}</td>
        <td className="ms-match-ai">AI #{index + 1}</td>
        <td>
          <span className={cls}>{label}</span>
        </td>
        <td>
          <button
            className={`ms-code-btn${codeOpen ? " ms-code-btn--active" : ""}`}
            onClick={onCodeToggle}
            disabled={!canShowCode}
          >
            {codeOpen ? "코드 닫기" : "코드 확인"}
          </button>
        </td>
        <td>
          <div className="ms-log-actions">
            <button
              className={`ms-log-btn${open ? " ms-log-btn--active" : ""}`}
              onClick={() => setOpen(v => !v)}
              disabled={!hasLog}
            >
              {open ? "로그 닫기 ▲" : "로그 보기 ▼"}
            </button>
            {hasVisualization && hasLog && (
              <button className="ms-viz-btn" onClick={() => onLogClick(match.log)}>
                로그 보러 가기
              </button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="ms-log-row">
          <td colSpan={5}>
            {hasLog
              ? <pre className="ms-log-preview">{match.log}</pre>
              : <div className="ms-log-empty">로그 내용이 없습니다.</div>}
          </td>
        </tr>
      )}
    </>
  );
}

// ── 제출 아이템 ──
function SubmissionItem({ sub, seqNum, userId, hasVisualization, onLogClick, selectMode, isSelected, onSelect }: {
  sub: LocalSubmission;
  seqNum: number;
  userId: string;
  hasVisualization: boolean;
  onLogClick: (log: string) => void;
  selectMode: boolean;
  isSelected: boolean;
  onSelect: (submissionId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [animKey,    setAnimKey]    = useState(0);
  const [flashType,  setFlashType]  = useState("pending");
  const prevMatchCountRef = useRef(sub.matches.length);
  const prevFinalizedRef  = useRef(sub.finalized);

  // 제출 코드 조회 (submissionId 단위) — 매치 행의 "코드 확인" 버튼으로 토글
  const [codeOpen,    setCodeOpen]    = useState(false);
  const [codeData,    setCodeData]    = useState<SubmissionCode | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError,   setCodeError]   = useState<string | null>(null);
  const canShowCode = sub.submissionId != null;

  const handleCodeToggle = () => {
    if (codeOpen) { setCodeOpen(false); return; }
    setCodeOpen(true);
    if (codeData || codeLoading || sub.submissionId == null) return;
    setCodeLoading(true);
    setCodeError(null);
    getSubmissionCode(sub.submissionId)
      .then(setCodeData)
      .catch(() => setCodeError("코드를 불러오지 못했습니다."))
      .finally(() => setCodeLoading(false));
  };

  useEffect(() => {
    const hasNewMatch   = sub.matches.length > prevMatchCountRef.current;
    const justFinalized = !prevFinalizedRef.current && sub.finalized;
    if (hasNewMatch || justFinalized) {
      if (hasNewMatch && sub.matches.length > 0) {
        // 방금 도착한 단건 매치의 결과를 사용
        const latest = sub.matches[sub.matches.length - 1];
        setFlashType(
          latest.winner === userId ? "win" :
          latest.winner === "draw" ? "draw" : "loss"
        );
      } else if (justFinalized) {
        // 신규 매치 없이 최종 확정만 된 경우 → 전체 결과 사용
        const w = sub.wins   ?? sub.matches.filter(m => m.winner === userId).length;
        const l = sub.losses ?? sub.matches.filter(m => m.winner !== userId && m.winner !== "draw").length;
        setFlashType(w > l ? "win" : l > w ? "loss" : "draw");
      }
      setAnimKey(k => k + 1);
      if (prevMatchCountRef.current === 0 && sub.matches.length > 0) setExpanded(true);
    }
    prevMatchCountRef.current = sub.matches.length;
    prevFinalizedRef.current  = sub.finalized;
  }, [sub.matches, sub.wins, sub.losses, sub.finalized, userId]);

  const wins   = sub.finalized && sub.wins   !== undefined ? sub.wins   : sub.matches.filter(m => m.winner === userId).length;
  const losses = sub.finalized && sub.losses !== undefined ? sub.losses : sub.matches.filter(m => m.winner !== userId && m.winner !== "draw").length;
  const total  = sub.matches.length;
  const draws  = total - wins - losses;

  const resultType = sub.error ? "error"
    : total === 0 ? "pending"
    : wins > losses ? "win"
    : losses > wins ? "loss"
    : "draw";

  // 코드 선택 모드: 카드 강제 접힘 + 클릭 시 선택(펼침 아님). submissionId 없는 항목은 선택 불가
  const selectable        = selectMode && sub.submissionId != null;
  const effectiveExpanded = !selectMode && expanded;
  const handleHeaderClick = () => {
    if (selectMode) {
      if (sub.submissionId != null) onSelect(sub.submissionId);
      return;
    }
    setExpanded(v => !v);
  };

  const itemCls = [
    "ms-item", `ms-item--${resultType}`,
    selectMode ? "ms-item--selectmode" : "",
    selectable ? "ms-item--selectable" : "",
    selectMode && !selectable ? "ms-item--unselectable" : "",
    isSelected ? "ms-item--chosen" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={itemCls}>
      {animKey > 0 && <div key={animKey} className={`ms-item-flash ms-item-flash--${flashType}`} aria-hidden="true" />}
      <div
        className="ms-item-header"
        onClick={handleHeaderClick}
        style={{ cursor: selectMode ? (selectable ? "pointer" : "not-allowed") : "pointer" }}
      >
        <span className="ms-item-seq">#{seqNum}</span>
        {isSelected && <span className="ms-chosen-badge">출전 코드</span>}
        <span className="ms-item-date">{formatDate(sub.submittedAt)}</span>


        <span className="ms-item-record">
          {sub.error ? (
            <span className="ms-error-inline">채점 중 오류 발생</span>
          ) : total === 0 ? (
            <span className="ms-pending">
              <span className="ms-spinner" aria-hidden="true" />
              채점 중...
            </span>
          ) : (
            <>
              <span className="ms-win">{wins}승</span>
              {" "}
              <span className="ms-draw">{draws}무</span>
              {" "}
              <span className="ms-loss">{losses}패</span>
              <span className="ms-total"> / {total}전</span>
            </>
          )}
        </span>

        <span className={`ms-result-label ms-result-label--${resultType}`}>
          {resultType === "win" ? "승" : resultType === "loss" ? "패" : resultType === "draw" ? "무" : resultType === "error" ? "오류" : "…"}
        </span>

        {selectMode ? (
          <span className={`ms-select-cue${selectable ? "" : " ms-select-cue--no"}`}>
            {selectable ? "선택" : "선택 불가"}
          </span>
        ) : (
          <button
            className="ms-expand-btn"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}
      </div>

      {effectiveExpanded && (
        <div className="ms-item-body">
          <table className="ms-match-table">
            <thead>
              <tr>
                <th>매치</th>
                <th>상대 AI</th>
                <th>결과</th>
                <th>코드</th>
                <th>로그</th>
              </tr>
            </thead>
            <tbody>
              {sub.matches.map((m, i) => (
                <MatchRow
                  key={`${m.matchId}-${i}`}
                  match={m}
                  index={i}
                  userId={userId}
                  hasVisualization={hasVisualization}
                  onLogClick={onLogClick}
                  codeOpen={codeOpen}
                  canShowCode={canShowCode}
                  onCodeToggle={handleCodeToggle}
                />
              ))}
            </tbody>
          </table>

          {/* 제출 코드 영역 — "코드 확인" 클릭 시 카드 아래에 표시 (language + code) */}
          {codeOpen && (
            <div className="ms-code-panel">
              {codeLoading && <div className="ms-code-status">코드 불러오는 중...</div>}
              {codeError && !codeLoading && <div className="ms-code-status ms-code-status--error">{codeError}</div>}
              {codeData && !codeLoading && !codeError && (
                <>
                  <div className="ms-code-lang">{codeData.language}</div>
                  <div
                    className="ms-code-editor"
                    style={{ height: Math.min(Math.max(codeData.code.split("\n").length, 6), 26) * 19 + 16 }}
                  >
                    <Editor
                      height="100%"
                      language={toMonacoLang(codeData.language)}
                      value={codeData.code}
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        domReadOnly: true,
                        fontSize: 13,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        tabSize: 4,
                        automaticLayout: true,
                        lineNumbers: "on",
                        renderLineHighlight: "none",
                        contextmenu: false,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 탭 컴포넌트 ──
const MySubmissionsTab: React.FC<Props> = ({
  contestId, refreshKey, localSubmissions, onLocalUpdate, onLogClick, userId, hasVisualization = false,
}) => {
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [sseStatus, setSseStatus]   = useState<SseStatus>(getSseStatus);
  const [sortOrder, setSortOrder]   = useState<SortOrder>("newest");

  // 코드 선택(토너먼트 출전) 모드
  const [selectMode,   setSelectMode]   = useState(false);
  const [pendingId,    setPendingId]    = useState<number | null>(null); // 확인 대기 중인 submissionId
  const [selecting,    setSelecting]    = useState(false);
  const [selectError,  setSelectError]  = useState<string | null>(null);
  const [chosenId,     setChosenId]     = useState<number | null>(null); // 출전 확정된 submissionId
  const [showHelp,     setShowHelp]     = useState(false);

  const handleConfirmSelect = async () => {
    if (pendingId == null) return;
    setSelecting(true);
    setSelectError(null);
    try {
      await selectSubmissionCode(contestId, pendingId);
      setChosenId(pendingId);
      setPendingId(null);
      setSelectMode(false);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? "코드 선택에 실패했습니다.";
      setSelectError(typeof msg === "string" ? msg : "코드 선택에 실패했습니다.");
    } finally {
      setSelecting(false);
    }
  };

  useEffect(() => {
    setStatusCallback(setSseStatus);
    return () => setStatusCallback(null);
  }, []);

  // SSE가 재연결 한도 초과로 끊기면 채점 중인 제출을 오류 상태로 전환
  const prevSseStatusRef = useRef<SseStatus>(getSseStatus());
  useEffect(() => {
    if (prevSseStatusRef.current !== "disconnected" && sseStatus === "disconnected") {
      onLocalUpdate(prev =>
        prev.map(s =>
          s.finalized || s.error
            ? s
            : { ...s, error: "SSE 연결 오류로 채점 결과를 받지 못했습니다." }
        )
      );
    }
    prevSseStatusRef.current = sseStatus;
  }, [sseStatus, onLocalUpdate]);

  const localSubmissionsRef = useRef(localSubmissions);
  useEffect(() => { localSubmissionsRef.current = localSubmissions; }, [localSubmissions]);

  const fetchFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyBattleSubmissions(contestId, userId);
      onLocalUpdate(prev => {
        // 서버 항목을 submissionId로 그룹화 → 각 그룹을 하나의 LocalSubmission으로 변환
        const grouped = new Map<number, ContestSubmissionResponse[]>();
        for (const item of data) {
          const id = item.submissionId;
          if (!grouped.has(id)) grouped.set(id, []);
          grouped.get(id)!.push(item);
        }
        const serverItems = Array.from(grouped.values())
          .map(group => serverGroupToLocal(group, userId))
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());

        // prev의 모든 항목(진행 중·완료 모두)을 순회하며 로컬 데이터를 보존
        // submissionId가 없는 항목만 서버 항목과 시각 매칭해 ID를 보완
        const MATCH_MS = 120_000;
        const accountedServerIds = new Set<number>();

        const updatedLocal = prev.map(local => {
          if (local.submissionId != null) {
            accountedServerIds.add(local.submissionId);
            return local; // ID 있음 → 로컬 데이터 그대로 유지 (SSE 결과 보존)
          }
          const matched = serverItems.find(s =>
            s.submissionId != null &&
            !accountedServerIds.has(s.submissionId!) &&
            Math.abs(s.submittedAt.getTime() - local.submittedAt.getTime()) < MATCH_MS
          );
          if (matched?.submissionId != null) {
            accountedServerIds.add(matched.submissionId);
            return { ...local, submissionId: matched.submissionId }; // ID만 보완, 나머지 로컬 유지
          }
          return local;
        });

        // 로컬에 없는 과거 서버 항목 추가 (새로고침으로 불러온 이전 제출 등)
        const historical = serverItems.filter(
          s => s.submissionId != null && !accountedServerIds.has(s.submissionId!)
        );

        return [...updatedLocal, ...historical]
          .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      });
    } catch (e: any) {
      setError(e.response?.data?.message ?? "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contestId, onLocalUpdate, userId]);

  useEffect(() => {
    fetchFromServer();
  }, [fetchFromServer, refreshKey]);

  // 마운트 시 기존 선택 코드 조회 (페이지 새로고침 후에도 출전 코드 표시 유지)
  useEffect(() => {
    getMySelectedSubmission(contestId)
      .then(res => {
        if (res != null) setChosenId(res);
      })
      .catch(() => {});
  }, [contestId]);

  // 정렬 적용 (내부 정렬 — localSubmissions 자체는 항상 최신순 유지)
  const sorted = [...localSubmissions].sort((a, b) =>
    sortOrder === "newest"
      ? b.submittedAt.getTime() - a.submittedAt.getTime()
      : a.submittedAt.getTime() - b.submittedAt.getTime()
  );
  const total = sorted.length;

  return (
    <div className="ms-container">
      <div className="ms-header-row">
        {/* 좌측: 제목 + SSE 뱃지 / 모바일에서 코드 선택 추가 */}
        <div className="ms-header-left">
          <div className="ms-header-title-row">
            <h2 className="ms-title">내 제출 이력</h2>
          </div>
          <div className="ms-mobile-select-area">
            <button
              className={`ms-mobile-select-btn${selectMode ? " ms-mobile-select-btn--active" : ""}`}
              onClick={() => { setSelectMode(m => !m); setPendingId(null); setSelectError(null); }}
            >
              {selectMode ? "선택 취소" : "코드 선택"}
            </button>
            <button
              className="ms-help-btn"
              onClick={() => setShowHelp(true)}
              aria-label="코드 선택 도움말"
            >
              ?
            </button>
          </div>
        </div>
        {/* 우측: 정렬 버튼 + 새로고침 */}
        <div className="ms-header-right">
          <div className="ms-sort-group">
            <button
              className={`ms-sort-btn${sortOrder === "newest" ? " ms-sort-btn--active" : ""}`}
              onClick={() => setSortOrder("newest")}
            >
              최신순
            </button>
            <button
              className={`ms-sort-btn${sortOrder === "oldest" ? " ms-sort-btn--active" : ""}`}
              onClick={() => setSortOrder("oldest")}
            >
              오래된 순
            </button>
          </div>
          <button className="ms-refresh-btn" onClick={fetchFromServer} disabled={loading} title="새로고침" aria-label="새로고침">
            ↻
          </button>
        </div>
      </div>

      {error && <div className="ms-error">{error}</div>}

      {selectMode && (
        <div className="ms-select-banner">
          토너먼트에 출전시킬 코드를 선택하세요. 카드를 클릭하면 선택됩니다.
        </div>
      )}

      <div className="ms-list-area">
        {sorted.length === 0 ? (
          <div className="ms-empty-state">
            {loading ? "불러오는 중..." : "아직 제출한 코드가 없습니다."}
          </div>
        ) : (
          <div className="ms-list">
            {sorted.map((sub, i) => {
              // 제출 번호: 오래된 것부터 #1. 최신순 표시 시 n-i, 오래된 순 시 i+1
              const seqNum = sortOrder === "newest" ? total - i : i + 1;
              return (
                <SubmissionItem
                  key={sub.submittedAt.toISOString()}
                  sub={sub}
                  seqNum={seqNum}
                  userId={userId}
                  hasVisualization={hasVisualization}
                  onLogClick={onLogClick}
                  selectMode={selectMode}
                  isSelected={sub.submissionId != null && sub.submissionId === chosenId}
                  onSelect={(id) => { setPendingId(id); setSelectError(null); }}
                />
              );
            })}
          </div>
        )}

        {/* 우측 레일 — 코드 선택 / 도움말 */}
        <div className="ms-select-rail">
          <button
            className={`ms-select-btn${selectMode ? " ms-select-btn--active" : ""}`}
            onClick={() => { setSelectMode(m => !m); setPendingId(null); setSelectError(null); }}
            title="토너먼트에 출전할 코드를 선택합니다"
          >
            {selectMode ? "선택 취소" : "코드 선택"}
          </button>
          <button
            className="ms-help-btn"
            onClick={() => setShowHelp(true)}
            aria-label="코드 선택 도움말"
          >
            ?
          </button>
        </div>
      </div>

      {/* 코드 선택 확인 팝업 */}
      {pendingId != null && (
        <div className="ms-modal-overlay" onClick={() => !selecting && setPendingId(null)}>
          <div className="ms-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ms-modal-title">코드 출전 확인</h3>
            <p className="ms-modal-text">이 코드를 토너먼트에 출전시키겠습니까?</p>
            <p className="ms-modal-sub">선택한 코드가 스위스 세션과 최종 풀 리그에 참가합니다.</p>
            {selectError && <p className="ms-modal-error">{selectError}</p>}
            <div className="ms-modal-actions">
              <button className="ms-modal-btn ms-modal-btn--ghost" onClick={() => setPendingId(null)} disabled={selecting}>
                취소
              </button>
              <button className="ms-modal-btn ms-modal-btn--primary" onClick={handleConfirmSelect} disabled={selecting}>
                {selecting ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 코드 선택 도움말 팝업 — 다른 영역 클릭 시 최소화 */}
      {showHelp && (
        <div className="ms-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="ms-help-pop" onClick={e => e.stopPropagation()}>
            <div className="ms-help-pop-title">코드 선택이란?</div>
            <p>
              여러 번 제출한 코드 중 <strong>토너먼트에 출전시킬 코드 하나</strong>를 직접 고르는 기능입니다.
            </p>
            <p>
              선택한 코드가 이후 진행되는 <strong>스위스 세션</strong>과 <strong>최종 풀 리그</strong>에 참가하여
              다른 참가자들의 코드와 대결합니다.
            </p>
            <p className="ms-help-pop-tip">
              "코드 선택" 버튼을 누른 뒤 원하는 제출 카드를 클릭하면 출전 코드로 지정할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MySubmissionsTab;
