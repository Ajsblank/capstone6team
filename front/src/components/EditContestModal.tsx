import React, { useState, useEffect } from "react";
import { ContestDetail } from "../api/codeBattleApi";
import { patchContest, PatchContestData, ContestStatus } from "../api/contestApi";
import "./EditContestModal.css";

interface Props {
  contestId: number;
  initial: ContestDetail;
  onClose: () => void;
  onSaved: (updated: Partial<ContestDetail>) => void;
}

const STATUS_OPTIONS: { value: ContestStatus; label: string }[] = [
  { value: "TEST",    label: "테스트" },
  { value: "PLANNED", label: "예정" },
  { value: "RUNNING", label: "진행 중" },
  { value: "PAUSED",  label: "일시 정지" },
  { value: "END",     label: "종료" },
];

// "YYYY-MM-DD HH:MM" → datetime-local input 값 "YYYY-MM-DDTHH:MM"
function toInputDatetime(dt: string): string {
  if (!dt) return "";
  return dt.replace(" ", "T").slice(0, 16);
}

// datetime-local 값 "YYYY-MM-DDTHH:MM" → API 형식 "YYYY-MM-DD HH:MM"
function toApiDatetime(dt: string): string {
  return dt.replace("T", " ");
}

const EditContestModal: React.FC<Props> = ({ contestId, initial, onClose, onSaved }) => {
  const [title, setTitle]                 = useState(initial.title);
  const [description, setDescription]     = useState(initial.description);
  const [certification, setCertification] = useState(initial.certification);
  const [timeLimitSec, setTimeLimitSec]   = useState(String(initial.timeLimitSec));
  const [memoryLimitMb, setMemoryLimitMb] = useState(String(initial.memoryLimitMb));
  const [maxParticipants, setMaxParticipants] = useState(String(initial.maxParticipants));
  const [status, setStatus]               = useState<ContestStatus>(initial.status as ContestStatus);
  const [startDate, setStartDate]         = useState(toInputDatetime(initial.startDate));
  const [endDate, setEndDate]             = useState(toInputDatetime(initial.endDate));
  const [sampleCode, setExampleCode]     = useState(initial.sampleCodes?.[0]?.code ?? "");
  const [judgeCode, setJudgeCode]         = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // 구조/규칙 필드 잠금: 대회가 이미 시작된(RUNNING/PAUSED/END) 상태면
  // 대회명·시작일·최대 참가자·인증·시간/메모리 제한·채점/예제 코드 변경 불가.
  // 종료일·문제 설명·상태만 수정 가능. (PLANNED/TEST는 지금처럼 전체 수정 가능)
  const structureLocked = !(initial.status === "PLANNED" || initial.status === "TEST");

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }

    setSaving(true);
    setError(null);

    // 잠긴 상태면 편집 가능한 필드(종료일·설명·상태)만 전송한다.
    const payload: PatchContestData = structureLocked
      ? {
          description: description.trim(),
          status,
          endDate:     endDate ? toApiDatetime(endDate) : undefined,
        }
      : {
          title:           title.trim(),
          description:     description.trim(),
          certification,
          timeLimitSec:    Number(timeLimitSec),
          memoryLimitMb:   Number(memoryLimitMb),
          maxParticipants: Number(maxParticipants),
          status,
          startDate:       startDate ? toApiDatetime(startDate) : undefined,
          endDate:         endDate   ? toApiDatetime(endDate)   : undefined,
          sampleCode:      sampleCode || undefined,
          judgeCode:       judgeCode.trim() || undefined,
        };

    try {
      await patchContest(contestId, payload);
      // 부모는 {...prev, ...updated}로 병합하므로, 전송한(=변경된) 필드만 넘긴다.
      const updated: Partial<ContestDetail> = {
        description: payload.description,
        status:      payload.status,
      };
      if (payload.endDate !== undefined) updated.endDate = payload.endDate;
      if (!structureLocked) {
        updated.title           = payload.title;
        updated.certification   = payload.certification;
        updated.timeLimitSec    = payload.timeLimitSec;
        updated.memoryLimitMb   = payload.memoryLimitMb;
        updated.maxParticipants = payload.maxParticipants;
        if (payload.startDate !== undefined) updated.startDate = payload.startDate;
        if (payload.sampleCode) updated.sampleCodes = [{ code: payload.sampleCode, language: "" }];
      }
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ?? "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ecm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ecm-modal">
        <div className="ecm-header">
          <h2 className="ecm-title">대회 수정</h2>
          <button className="ecm-close-btn" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <form className="ecm-body" onSubmit={handleSubmit}>
          {structureLocked && (
            <div className="ecm-lock-notice">
              <span className="ecm-lock-icon">🔒</span>
              <span>대회가 이미 시작되어 <strong>대회명 · 시작일 · 최대 참가자 · 인증 · 시간/메모리 제한 · 코드</strong>는 수정할 수 없습니다. <strong>종료일 · 문제 설명 · 상태</strong>만 변경 가능합니다.</span>
            </div>
          )}

          {/* 제목 */}
          <div className="ecm-field">
            <label className="ecm-label">제목 *</label>
            <input className="ecm-input" value={title} onChange={e => setTitle(e.target.value)} disabled={structureLocked} />
          </div>

          {/* 설명 */}
          <div className="ecm-field">
            <label className="ecm-label">문제 설명</label>
            <textarea className="ecm-textarea ecm-textarea--md" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* 상태 */}
          <div className="ecm-field">
            <label className="ecm-label">상태</label>
            <select className="ecm-select" value={status} onChange={e => setStatus(e.target.value as ContestStatus)}>
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
          <div className="ecm-row">
            <div className="ecm-field">
              <label className="ecm-label">시작 일시</label>
              <input className="ecm-input" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={structureLocked} />
            </div>
            <div className="ecm-field">
              <label className="ecm-label">종료 일시</label>
              <input className="ecm-input" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* 제한 */}
          <div className="ecm-row">
            <div className="ecm-field">
              <label className="ecm-label">시간 제한 (초)</label>
              <input className="ecm-input" type="number" min={1} value={timeLimitSec} onChange={e => setTimeLimitSec(e.target.value)} disabled={structureLocked} />
            </div>
            <div className="ecm-field">
              <label className="ecm-label">메모리 제한 (MB)</label>
              <input className="ecm-input" type="number" min={1} value={memoryLimitMb} onChange={e => setMemoryLimitMb(e.target.value)} disabled={structureLocked} />
            </div>
            <div className="ecm-field">
              <label className="ecm-label">최대 참가자</label>
              <input className="ecm-input" type="number" min={1} value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} disabled={structureLocked} />
            </div>
          </div>

          {/* 인증 */}
          <div className="ecm-field ecm-field--inline">
            <input id="ecm-cert" type="checkbox" checked={certification} onChange={e => setCertification(e.target.checked)} disabled={structureLocked} />
            <label htmlFor="ecm-cert" className="ecm-label ecm-label--inline">인증 대회</label>
          </div>

          {/* 예제 코드 */}
          <div className="ecm-field">
            <label className="ecm-label">예제 코드</label>
            <textarea className="ecm-textarea ecm-textarea--code" value={sampleCode} onChange={e => setExampleCode(e.target.value)} spellCheck={false} disabled={structureLocked} />
          </div>

          {/* 채점 코드 */}
          <div className="ecm-field">
            <label className="ecm-label">채점 코드 <span className="ecm-label--hint">(변경 시에만 입력)</span></label>
            <textarea className="ecm-textarea ecm-textarea--code" value={judgeCode} onChange={e => setJudgeCode(e.target.value)} placeholder="변경하지 않으면 비워두세요." spellCheck={false} disabled={structureLocked} />
          </div>

          {error && <p className="ecm-error">{error}</p>}

          <div className="ecm-footer">
            <button type="button" className="ecm-btn ecm-btn--cancel" onClick={onClose}>취소</button>
            <button type="submit" className="ecm-btn ecm-btn--save" disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditContestModal;
