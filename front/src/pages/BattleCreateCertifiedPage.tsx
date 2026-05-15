import React, { useState } from "react";
import axios from "axios";
import { useApp } from "../context/AppContext";
import { createCertifiedContest, ContestResponse } from "../api/contestApi";
import { getContestDraft, clearContestDraft } from "../contestDraft";
import "./AppLayout.css";
import "./BattleCreateContestPage.css";

const BattleCreateCertifiedPage: React.FC = () => {
  const { user, logout, navigate } = useApp();

  const [emails, setEmails] = useState<string[]>([""]);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [createdContest, setCreatedContest] = useState<ContestResponse | null>(null);

  const handleAddEmail = () => setEmails(prev => [...prev, ""]);

  const handleRemoveEmail = (i: number) =>
    setEmails(prev => prev.filter((_, idx) => idx !== i));

  const handleEmailChange = (i: number, v: string) =>
    setEmails(prev => prev.map((e, idx) => (idx === i ? v : e)));

  const handleSubmit = async () => {
    const draft = getContestDraft();
    if (!draft) {
      setSubmitStatus("error");
      setErrorMsg("폼 데이터가 없습니다. 이전 단계로 돌아가서 다시 시도해주세요.");
      return;
    }

    const validEmails = emails.map(e => e.trim()).filter(Boolean);
    if (validEmails.length === 0) {
      setSubmitStatus("error");
      setErrorMsg("검수자 이메일을 최소 1개 입력해주세요.");
      return;
    }

    setSubmitStatus("submitting");
    setErrorMsg("");
    try {
      const result = await createCertifiedContest(draft, validEmails);
      clearContestDraft();
      setCreatedContest(result);
    } catch (err: unknown) {
      setSubmitStatus("error");
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message ?? err.response?.statusText;
        setErrorMsg(msg ? `[${err.response?.status}] ${msg}` : "서버에 연결할 수 없습니다.");
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("알 수 없는 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="cc-page">
      {createdContest !== null && (
        <div className="cc-modal-overlay">
          <div className="cc-modal">
            <div className="cc-modal-icon">✓</div>
            <p className="cc-modal-msg">대회가 성공적으로 등록되었습니다.</p>
            <div className="cc-modal-info">
              <div className="cc-modal-info-row">
                <span className="cc-modal-info-label">ID</span>
                <span className="cc-modal-info-value">{createdContest.id}</span>
              </div>
              <div className="cc-modal-info-row">
                <span className="cc-modal-info-label">상태</span>
                <span className="cc-modal-info-value">{createdContest.status}</span>
              </div>
              <div className="cc-modal-info-row">
                <span className="cc-modal-info-label">생성 일시</span>
                <span className="cc-modal-info-value">
                  {new Date(createdContest.createdAt).toLocaleString("ko-KR")}
                </span>
              </div>
            </div>
            <button
              className="cc-modal-confirm"
              onClick={() => { setCreatedContest(null); navigate("battle"); }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      <header className="home-header">
        <span className="home-logo" onClick={() => navigate("landing")}>
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
        </span>
        <div className="cc-header-spacer" />
        <div className="home-auth-area">
          <button className="home-auth-btn home-auth-btn--ghost" onClick={() => navigate("home")}>
            📝 알고리즘 문제
          </button>
          {user ? (
            <>
              <span className="home-username" onClick={() => navigate("profile")}>{user.username}</span>
              <button className="home-auth-btn home-auth-btn--secondary" onClick={() => navigate("account-settings")}>설정</button>
              <button className="home-auth-btn home-auth-btn--ghost" onClick={() => logout()}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="home-auth-btn home-auth-btn--ghost" onClick={() => navigate("signup")}>회원가입</button>
              <button className="home-auth-btn home-auth-btn--primary" onClick={() => navigate("login")}>로그인</button>
            </>
          )}
        </div>
      </header>

      <main className="home-body">
        <div className="cc-content">
          <div className="cc-form-wrapper">
            <button className="cc-back-link" onClick={() => navigate("create-contest")}>
              ← 이전 단계
            </button>
            <h2 className="cc-page-title">대회 개최 — 검수자 설정</h2>

            <div className="cc-form">
              <section className="cc-section">
                <h3 className="cc-section-title">검수자 이메일</h3>
                <p className="cc-reviewer-desc">
                  인증 대회를 검수할 담당자의 이메일을 입력하세요. 최소 1명 이상 필요합니다.
                </p>

                <div className="cc-reviewer-list">
                  {emails.map((email, i) => (
                    <div key={i} className="cc-reviewer-row">
                      <input
                        className="cc-input"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={e => handleEmailChange(i, e.target.value)}
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          className="cc-reviewer-remove"
                          onClick={() => handleRemoveEmail(i)}
                          aria-label="이메일 삭제"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="cc-reviewer-add"
                  onClick={handleAddEmail}
                >
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
                <button
                  type="button"
                  className="cc-cancel-btn"
                  onClick={() => navigate("battle")}
                >
                  취소
                </button>
                {submitStatus === "error" && (
                  <span className="cc-error-msg">{errorMsg}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BattleCreateCertifiedPage;
