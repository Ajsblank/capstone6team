import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import BattleTopNav from "../components/BattleTopNav";
import Breadcrumb from "../components/Breadcrumb";
import { getContestDraft } from "../contestDraft";
import ContestSidebar from "../components/ContestSidebar";
import { PAYMENT_AMOUNT, buildDraft, saveDraft, requestTossPayment } from "../api/paymentApi";
import "./AppLayout.css";
import "./BattleCreateContestPage.css";

const BattleCreateCertifiedPage: React.FC = () => {
  const { user, navigate } = useApp();

  const hostEmail = user?.email ?? "";
  const [emails, setEmails] = useState<string[]>([]);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleAddEmail = () => setEmails(prev => [...prev, ""]);

  const handleRemoveEmail = (i: number) =>
    setEmails(prev => prev.filter((_, idx) => idx !== i));

  const handleEmailChange = (i: number, v: string) =>
    setEmails(prev => prev.map((e, idx) => (idx === i ? v : e)));

  const handleSubmit = async () => {
    const contestFormDraft = getContestDraft();
    if (!contestFormDraft) {
      setSubmitStatus("error");
      setErrorMsg("폼 데이터가 없습니다. 이전 단계로 돌아가서 다시 시도해주세요.");
      return;
    }
    if (!hostEmail) {
      setSubmitStatus("error");
      setErrorMsg("로그인 정보에 이메일이 없습니다. 다시 로그인해주세요.");
      return;
    }

    const additionalEmails = emails.map(e => e.trim()).filter(e => e && e !== hostEmail);
    const reviewerEmails   = [hostEmail, ...additionalEmails];

    setSubmitStatus("submitting");
    setErrorMsg("");
    try {
      const orderId = "order-" + crypto.randomUUID();
      const draft = await buildDraft(orderId, PAYMENT_AMOUNT.certified, {
        ...contestFormDraft,
        reviewerEmails,
      });
      saveDraft(draft);
      await requestTossPayment(orderId, PAYMENT_AMOUNT.certified, "인증 대회 개최");
    } catch (err: any) {
      setSubmitStatus("error");
      setErrorMsg(err?.message ?? "결제 요청 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="cc-page">

      <BattleTopNav spacer />

      <main className="home-body">
        <div className="cc-content">
          <div className="cc-layout">

            {/* ── 폼 컬럼 ── */}
            <div className="cc-form-col">
              <Breadcrumb items={[
                { label: "대회 목록", onClick: () => navigate("battle") },
                { label: "대회 개최", onClick: () => navigate("create-contest") },
                { label: "검수자 설정" },
              ]} />
              <h2 className="cc-page-title">대회 개최 — 검수자 설정</h2>

              <div className="cc-form">
                <section className="cc-section">
                  <h3 className="cc-section-title">검수자 이메일</h3>
                  <p className="cc-reviewer-desc">
                    인증 대회를 검수할 담당자의 이메일을 입력하세요. 최소 1명 이상 필요합니다.
                  </p>

                  <div className="cc-reviewer-list">
                    {/* 개최자 이메일 — 기본 포함, 비활성화 */}
                    <div className="cc-reviewer-row cc-reviewer-row--default">
                      <input
                        className="cc-input"
                        type="email"
                        value={hostEmail}
                        disabled
                        readOnly
                      />
                      <span className="cc-reviewer-badge">개최자</span>
                    </div>

                    {/* 추가 검수자 이메일 */}
                    {emails.map((email, i) => (
                      <div key={i} className="cc-reviewer-row">
                        <input
                          className="cc-input"
                          type="email"
                          placeholder="example@email.com"
                          value={email}
                          onChange={e => handleEmailChange(i, e.target.value)}
                        />
                        <button
                          type="button"
                          className="cc-reviewer-remove"
                          onClick={() => handleRemoveEmail(i)}
                          aria-label="이메일 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="cc-reviewer-add" onClick={handleAddEmail}>
                    + 검수자 추가
                  </button>
                </section>

                <div className="cc-submit-area">
                  <button
                    type="button"
                    className="cc-submit-btn"
                    onClick={handleSubmit}
                    disabled={submitStatus === "submitting"}
                  >
                    {submitStatus === "submitting" ? "등록 중..." : "대회 생성"}
                  </button>
                  <button type="button" className="cc-cancel-btn" onClick={() => navigate("battle")}>
                    취소
                  </button>
                  {submitStatus === "error" && <span className="cc-error-msg">{errorMsg}</span>}
                </div>
              </div>
            </div>

            {/* ── 사이드바 컬럼 ── */}
            <aside className="cc-checklist-col">
              {(() => {
                const draft = getContestDraft();
                const step1Items = draft ? [
                  { label: "대회 이름",               done: !!draft.title },
                  { label: "문제 설명",               done: !!draft.description?.trim() },
                  { label: "채점 코드",               done: !!draft.judgeCode },
                  { label: "샘플 코드 (1개 이상)",     done: draft.sampleCodes.length > 0 },
                  { label: "예시 AI 코드 (1개 이상)", done: draft.exampleAiCodes.length > 0 },
                  { label: "시각화 HTML",             done: !!draft.visualizationHtml },
                  { label: "혼자서 하기 HTML",        done: !!draft.soloPlayHtml },
                  { label: "시작 일시",               done: !!draft.startDate },
                  { label: "종료 일시",               done: !!draft.endDate },
                ] : [];
                const validReviewerCount = (hostEmail ? 1 : 0) + emails.filter(e => e.trim()).length;
                return (
                  <ContestSidebar
                    currentStep={2}
                    certification={true}
                    step1Items={step1Items}
                    step1AllDone={true}
                    reviewerCount={validReviewerCount}
                  />
                );
              })()}
            </aside>

          </div>
        </div>
      </main>
    </div>
  );
};

export default BattleCreateCertifiedPage;
