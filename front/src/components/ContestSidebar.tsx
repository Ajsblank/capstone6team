import React from "react";

export interface SidebarCheckItem {
  label: string;
  done: boolean;
  optional?: boolean;
}

interface Props {
  currentStep: 1 | 2;
  certification: boolean;
  step1Items: SidebarCheckItem[];
  step1AllDone: boolean;
  reviewerCount?: number;
}

const CheckItem: React.FC<{ item: SidebarCheckItem }> = ({ item }) => (
  <li
    className={[
      "cc-checklist-item",
      item.done ? "cc-checklist-item--done" : "",
      item.optional && !item.done ? "cc-checklist-item--optional" : "",
    ].join(" ").trim()}
  >
    <span className="cc-checklist-icon">{item.done ? "✓" : "○"}</span>
    <span className="cc-checklist-label">
      {item.label}
      {item.optional && <span className="cc-checklist-opt"> (선택)</span>}
    </span>
  </li>
);

const ContestSidebar: React.FC<Props> = ({
  currentStep,
  certification,
  step1Items,
  step1AllDone,
  reviewerCount = 0,
}) => {
  if (!certification) {
    return (
      <div className="cc-checklist-panel">
        <div className="cc-checklist-header">
          <span className="cc-checklist-title">비인증 대회 체크리스트</span>
          {step1AllDone && <span className="cc-checklist-ready">준비 완료 ✓</span>}
        </div>
        <ul className="cc-checklist">
          {step1Items.map(item => <CheckItem key={item.label} item={item} />)}
        </ul>
      </div>
    );
  }

  return (
    <div className="cc-checklist-panel">
      {/* ── 1단계 ── */}
      <div className={`cc-step-section${currentStep !== 1 ? " cc-step-section--dim" : ""}`}>
        <div className="cc-step-header">
          <span className="cc-step-badge">1단계</span>
          <span className="cc-checklist-title">대회 정보</span>
          {currentStep === 1 && step1AllDone && (
            <span className="cc-checklist-ready">준비 완료 ✓</span>
          )}
          {currentStep === 2 && (
            <span className="cc-step-done-label">완료 ✓</span>
          )}
        </div>
        <ul className="cc-checklist">
          {step1Items.map(item => <CheckItem key={item.label} item={item} />)}
        </ul>
      </div>

      {/* ── 연결선 ── */}
      <div className="cc-step-connector" />

      {/* ── 2단계 ── */}
      <div className={`cc-step-section${currentStep !== 2 ? " cc-step-section--dim" : ""}`}>
        <div className="cc-step-header">
          <span className="cc-step-badge cc-step-badge--2">2단계</span>
          <span className="cc-checklist-title">검수자 설정</span>
          {currentStep === 2 && reviewerCount > 0 && (
            <span className="cc-checklist-ready">준비 완료 ✓</span>
          )}
        </div>
        <ul className="cc-checklist">
          <CheckItem item={{ label: "검수자 추가 (1명 이상)", done: reviewerCount > 0 }} />
        </ul>
      </div>
    </div>
  );
};

export default ContestSidebar;
