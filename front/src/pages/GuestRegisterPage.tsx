import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { tempSignupApi } from "../api/authApi";
import "./GuestRegisterPage.css";

const GuestRegisterPage: React.FC = () => {
  const { navigate } = useApp();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("올바른 이메일 형식을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      await tempSignupApi(email.trim(), nickname.trim());
      setSentEmail(email.trim());
    } catch (err: any) {
      console.error("[temp-signup] status:", err?.response?.status);
      console.error("[temp-signup] data:", err?.response?.data);
      const data = err?.response?.data;
      const msg = data?.message ?? data?.error ?? (typeof data === "string" ? data : null) ?? "등록 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (sentEmail) {
    return (
      <div className="guest-register-page">
        <div className="guest-register-card">
          <div className="guest-register-logo" onClick={() => navigate("landing")}>
            <img
              src="/resources/logo/TacticalCodeBattle_logo.png"
              alt="TCB"
              className="guest-register-logo-img"
            />
          </div>
          <div className="guest-register-sent">
            <div className="guest-register-sent-icon">✉</div>
            <h2 className="guest-register-sent-title">메일을 확인해주세요</h2>
            <p className="guest-register-sent-desc">
              <strong>{sentEmail}</strong>으로<br />
              로그인 정보와 자동 로그인 링크를 발송했습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-register-page">
      <div className="guest-register-card">
        <div className="guest-register-logo" onClick={() => navigate("landing")}>
          <img
            src="/resources/logo/TacticalCodeBattle_logo.png"
            alt="TCB"
            className="guest-register-logo-img"
          />
        </div>

        <h2 className="guest-register-title">게스트 참가</h2>

        <ol className="guest-register-steps">
          <li>사용하실 이메일과 닉네임 입력</li>
          <li>입력하신 이메일에 발송된 비밀번호 확인 및 로그인</li>
        </ol>

        <form className="guest-register-form" onSubmit={handleSubmit} noValidate>
          <div className="guest-register-field">
            <label className="guest-register-label" htmlFor="guest-email">
              이메일
            </label>
            <input
              id="guest-email"
              className="guest-register-input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="guest-register-field">
            <label className="guest-register-label" htmlFor="guest-nickname">
              닉네임
            </label>
            <input
              id="guest-nickname"
              className="guest-register-input"
              type="text"
              placeholder="사용할 닉네임을 입력하세요"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
              inputMode="text"
              maxLength={20}
            />
          </div>

          {error && <p className="guest-register-error">{error}</p>}

          <button
            className="guest-register-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "등록 중..." : "게스트로 시작하기"}
          </button>
        </form>

      </div>
    </div>
  );
};

export default GuestRegisterPage;
