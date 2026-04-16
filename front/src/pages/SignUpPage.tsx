import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { signUp } from "../api/authApi";
import "./SignUpPage.css";

const SignUpPage: React.FC = () => {
  const { navigate } = useApp();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};

    if (!nickname.trim()) e.nickname = "닉네임을 입력해주세요.";
    else if (nickname.length < 2) e.nickname = "닉네임은 2자 이상이어야 합니다.";

    if (!email.trim()) e.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "올바른 이메일 형식이 아닙니다.";

    if (!password) e.password = "비밀번호를 입력해주세요.";
    else if (password.length < 8) e.password = "비밀번호는 8자 이상이어야 합니다.";

    if (!passwordConfirm) e.passwordConfirm = "비밀번호 확인을 입력해주세요.";
    else if (password !== passwordConfirm) e.passwordConfirm = "비밀번호가 일치하지 않습니다.";

    return e;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await signUp({ email, password, nickname });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "회원가입에 실패했습니다. 다시 시도해주세요.";
      setErrors({ api: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="signup-page">
        <div className="signup-card">
          <div className="signup-logo" onClick={() => navigate("home")}>CodeBattle</div>
          <div className="signup-success">
            <div className="signup-success-icon">✓</div>
            <h2 className="signup-success-title">회원가입 완료</h2>
            <p className="signup-success-msg">회원가입이 완료되었습니다.<br />로그인 후 이용해주세요.</p>
            <button className="signup-btn signup-btn--primary" onClick={() => navigate("login")}>
              로그인 하러 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <div className="signup-logo" onClick={() => navigate("home")}>CodeBattle</div>
        <h2 className="signup-title">회원가입</h2>

        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <div className="signup-field">
            <label className="signup-label" htmlFor="signup-nickname">닉네임 *</label>
            <input
              id="signup-nickname"
              className={`signup-input${errors.nickname ? " signup-input--error" : ""}`}
              type="text"
              placeholder="2자 이상의 닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
            />
            {errors.nickname && <span className="signup-field-error">{errors.nickname}</span>}
          </div>

          <div className="signup-field">
            <label className="signup-label" htmlFor="signup-email">이메일 *</label>
            <input
              id="signup-email"
              className={`signup-input${errors.email ? " signup-input--error" : ""}`}
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && <span className="signup-field-error">{errors.email}</span>}
          </div>

          <div className="signup-field">
            <label className="signup-label" htmlFor="signup-password">비밀번호 *</label>
            <input
              id="signup-password"
              className={`signup-input${errors.password ? " signup-input--error" : ""}`}
              type="password"
              placeholder="8자 이상의 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            {errors.password && <span className="signup-field-error">{errors.password}</span>}
          </div>

          <div className="signup-field">
            <label className="signup-label" htmlFor="signup-password-confirm">비밀번호 확인 *</label>
            <input
              id="signup-password-confirm"
              className={`signup-input${errors.passwordConfirm ? " signup-input--error" : ""}`}
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
            />
            {errors.passwordConfirm && <span className="signup-field-error">{errors.passwordConfirm}</span>}
          </div>

          {errors.api && <p className="signup-field-error signup-field-error--api">{errors.api}</p>}

          <button className="signup-btn signup-btn--primary" type="submit" disabled={submitting}>
            {submitting ? "처리 중..." : "회원가입"}
          </button>
        </form>

        <div className="signup-footer">
          <span className="signup-footer-text">이미 계정이 있으신가요?</span>
          <button className="signup-link-btn" onClick={() => navigate("login")}>
            로그인
          </button>
        </div>

        <button className="signup-back-btn" onClick={() => navigate("home")}>
          ← 홈으로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default SignUpPage;
