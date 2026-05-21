import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ContestDetail } from "../api/codeBattleApi";
import "./ChitoBattleProblem.css";

interface Props {
  detail: ContestDetail | null;
  loading: boolean;
  error: string | null;
  onJoin?: () => Promise<void>;
  joinStatus?: "idle" | "joining" | "joined" | "error";
  joinError?: string;
  isReviewer?: boolean;
  onEdit?: () => void;  // 개최자 본인일 때만 전달됨
}

const STATUS_LABELS: Record<string, string> = {
  TEST: "테스트",
  PLANNED: "예정",
  RUNNING: "진행 중",
  PAUSED: "일시 정지",
  END: "종료",
};

function formatDateTime(dt: string): string {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

const ContestProblemDetail: React.FC<Props> = ({ detail, loading, error, onJoin, joinStatus = "idle", joinError, isReviewer, onEdit }) => {
  if (loading) {
    return (
      <div className="prob" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>불러오는 중...</span>
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="prob" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#dc2626", fontSize: "0.9rem" }}>{error ?? "대회 정보를 불러오지 못했습니다."}</span>
      </div>
    );
  }

  return (
    <div className="prob">
      <div className="prob-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="prob-title" style={{ flex: 1 }}>{detail.title}</h1>
        {onEdit && (
          <button
            onClick={onEdit}
            style={{
              padding: "6px 16px",
              background: "#6644cc",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            수정
          </button>
        )}
      </div>

      {/* 대회 정보 */}
      <section className="prob-section">
        <h2>대회 정보</h2>
        <table className="prob-table" style={{ maxWidth: 520 }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 700, width: 130, whiteSpace: "nowrap" }}>상태</td>
              <td>{STATUS_LABELS[detail.status] ?? detail.status}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>시작 일시</td>
              <td>{formatDateTime(detail.startDate)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>종료 일시</td>
              <td>{formatDateTime(detail.endDate)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>시간 제한</td>
              <td>{detail.timeLimitSec}초</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>메모리 제한</td>
              <td>{detail.memoryLimitMb} MB</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>최대 참가자</td>
              <td>{detail.maxParticipants}명</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 700 }}>인증 대회</td>
              <td>{detail.certification ? "예" : "아니오"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 대회 참가 */}
      {onJoin && detail.status === "RUNNING" && (
        <section className="prob-section prob-join-section">
          <button
            className={`prob-join-btn${joinStatus === "joined" ? " prob-join-btn--done" : ""}`}
            onClick={isReviewer ? undefined : onJoin}
            disabled={isReviewer || joinStatus === "joining" || joinStatus === "joined"}
            title={isReviewer ? "검수자는 해당 대회에 참가할 수 없습니다" : undefined}
          >
            {isReviewer        ? "검수자 (참가 불가)" :
             joinStatus === "joining" ? "참가 신청 중..." :
             joinStatus === "joined"  ? "✓ 참가 완료" :
             "대회 참가"}
          </button>
          {joinStatus === "error" && joinError && (
            <p className="prob-join-error">{joinError}</p>
          )}
        </section>
      )}

      {/* 문제 설명 */}
      {detail.description && (
        <section className="prob-section">
          <h2>문제 설명</h2>
          <div className="prob-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.description}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* 예제 코드 */}
      {detail.sampleCode && (
        <section className="prob-section">
          <h2>예제 코드</h2>
          <pre style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: "16px 20px",
            borderRadius: "8px",
            fontSize: "0.82rem",
            fontFamily: '"Fira Code", "Consolas", monospace',
            overflowX: "auto",
            lineHeight: 1.6,
            margin: 0,
          }}>
            <code>{detail.sampleCode}</code>
          </pre>
        </section>
      )}
    </div>
  );
};

export default ContestProblemDetail;
