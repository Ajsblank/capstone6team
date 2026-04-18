import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { signUp, resendVerificationEmail, verifyEmailCode } from "../api/authApi";
import "./SignUpPage.css";

const CODE_LENGTH = 6;

// ── Email Verification Modal ──
interface VerifyModalProps {
  email: string;
  onVerified: () => void;
  onCancel: () => void;
}

const EmailVerifyModal: React.FC<VerifyModalProps> = ({ email, onVerified, onCancel }) => {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError("");
    if (cleaned && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < CODE_LENGTH) { setError("인증번호 6자리를 모두 입력해주세요."); return; }
    setVerifying(true);
    setError("");
    try {
      await verifyEmailCode(email, code);
      onVerified();
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "인증번호가 올바르지 않습니다.";
      setError(msg);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await resendVerificationEmail(email);
      setResendCooldown(60);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } catch {
      setError("재발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setResending(false);
    }
  };

  const isError = error.length > 0;

  return (
    <div className="verify-overlay">
      <div className="verify-card">
        <div className="verify-icon">✉</div>
        <h2 className="verify-title">이메일 인증</h2>
        <p className="verify-desc">
          <strong>{email}</strong>으로<br />발송된 인증번호 6자리를 입력해주세요.
        </p>

        <div className="verify-inputs" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              className={`verify-digit${isError ? " verify-digit--error" : ""}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
            />
          ))}
        </div>

        {error && <p className="verify-error">{error}</p>}

        <button
          className="verify-btn"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? "확인 중..." : "확인"}
        </button>

        <div className="verify-resend">
          <span>인증번호를 받지 못하셨나요?</span>
          <button
            className="verify-resend-btn"
            onClick={handleResend}
            disabled={resending || resendCooldown > 0}
          >
            {resendCooldown > 0 ? `재발송 (${resendCooldown}s)` : "재발송"}
          </button>
        </div>

        <button className="verify-cancel" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
};

// ── SignUp Page ──
const SignUpPage: React.FC = () => {
  const { navigate } = useApp();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
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

  // 1단계: 폼 제출 → signup API 호출 (백에서 인증번호 자동 발송) → 모달 표시
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await signUp({ email, password, nickname });
      setShowVerifyModal(true);
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "회원가입에 실패했습니다. 다시 시도해주세요.";
      setErrors({ api: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // 2단계: 인증 완료 → 성공 화면으로 전환
  const handleVerified = () => {
    setShowVerifyModal(false);
    setSubmitted(true);
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
    <>
      {showVerifyModal && (
        <EmailVerifyModal
          email={email}
          onVerified={handleVerified}
          onCancel={() => setShowVerifyModal(false)}
        />
      )}

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
    </>
  );
};

export default SignUpPage;
