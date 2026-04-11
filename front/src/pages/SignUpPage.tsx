import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import "./SignUpPage.css";

function generateCaptcha(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const SignUpPage: React.FC = () => {
  const { navigate } = useApp();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [school, setSchool] = useState("");
  const [email, setEmail] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaCode, setCaptchaCode] = useState(generateCaptcha);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const refreshCaptcha = () => {
    setCaptchaCode(generateCaptcha());
    setCaptchaAnswer("");
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!userId.trim()) e.userId = "아이디를 입력해주세요.";
    else if (userId.length < 4) e.userId = "아이디는 4자 이상이어야 합니다.";

    if (!password) e.password = "비밀번호를 입력해주세요.";
    else if (password.length < 8) e.password = "비밀번호는 8자 이상이어야 합니다.";

    if (!passwordConfirm) e.passwordConfirm = "비밀번호 확인을 입력해주세요.";
    else if (password !== passwordConfirm) e.passwordConfirm = "비밀번호가 일치하지 않습니다.";

    if (!email.trim()) e.email = "이메일을 입력해주세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "올바른 이메일 형식이 아닙니다.";

    if (captchaAnswer.toUpperCase() !== captchaCode) {
      e.captcha = "자동 입력 방지 코드가 올바르지 않습니다.";
      refreshCaptcha();
    }

    return e;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      // TODO: 실제 회원가입 API 연동
      setSubmitted(true);
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
            <label className="signup-label" htmlFor="signup-userid">아이디 *</label>
            <input
              id="signup-userid"
              className={`signup-input${errors.userId ? " signup-input--error" : ""}`}
              type="text"
              placeholder="4자 이상의 아이디"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
            />
            {errors.userId && <span className="signup-field-error">{errors.userId}</span>}
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

          <div className="signup-field">
            <label className="signup-label" htmlFor="signup-school">학교/소속</label>
            <input
              id="signup-school"
              className="signup-input"
              type="text"
              placeholder="학교 또는 소속 기관 (선택)"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
            />
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
            <label className="signup-label">자동 입력 방지 *</label>
            <div className="signup-captcha-wrap">
              <div className="signup-captcha-code">{captchaCode}</div>
              <button
                type="button"
                className="signup-captcha-refresh"
                onClick={refreshCaptcha}
                title="새로고침"
              >
                ↺
              </button>
            </div>
            <input
              className={`signup-input${errors.captcha ? " signup-input--error" : ""}`}
              type="text"
              placeholder="위 코드를 입력하세요"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              maxLength={5}
              autoComplete="off"
            />
            {errors.captcha && <span className="signup-field-error">{errors.captcha}</span>}
          </div>

          <button className="signup-btn signup-btn--primary" type="submit">
            회원가입
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
