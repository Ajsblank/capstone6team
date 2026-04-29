import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { loginApi, getUserId } from "../api/authApi";
import { subscribeToResults } from "../api/sseApi";
import "./LoginPage.css";

const LoginPage: React.FC = () => {
  const { navigate, login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const tokenData = await loginApi({ email, password });
      const uid = getUserId() ?? tokenData.userId;
      if (uid) subscribeToResults(uid, () => {});
      login({ id: uid ?? email, username: email, email });
      navigate("home");
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "이메일 또는 비밀번호가 올바르지 않습니다.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevLogin = async () => {
    setError("");
    setSubmitting(true);
    try {
      await loginApi({ email: "dev@codebattle.kr", password: "devpassword1!" });
      login({ id: "dev", username: "개발자", email: "dev@codebattle.kr" });
      navigate("home");
    } catch {
      // API 실패 시 토큰 없이 UI만 로그인 (개발 편의용)
      login({ id: "dev", username: "개발자", email: "dev@codebattle.kr" });
      navigate("home");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" onClick={() => navigate("home")}>CodeBattle</div>
        <h2 className="login-title">로그인</h2>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              className="login-input"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn login-btn--primary" type="submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {process.env.NODE_ENV === "development" && (
          <>
            <div className="login-divider"><span>또는</span></div>
            <button className="login-btn login-btn--dev" type="button" onClick={handleDevLogin}>
              개발자 로그인 (Debug)
            </button>
          </>
        )}

        <div className="login-footer">
          <span className="login-footer-text">계정이 없으신가요?</span>
          <button className="login-link-btn" onClick={() => navigate("signup")}>
            회원가입
          </button>
        </div>

        <button className="login-back-btn" onClick={() => navigate("home")}>
          ← 홈으로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
