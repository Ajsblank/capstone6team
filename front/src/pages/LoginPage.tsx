import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import "./LoginPage.css";

const LoginPage: React.FC = () => {
  const { navigate, login } = useApp();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!userId.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    // TODO: 실제 로그인 API 연동
    setError("로그인 기능은 준비 중입니다.");
  };

  const handleDevLogin = () => {
    login({ id: "dev", username: "개발자", email: "dev@codebattle.kr" });
    navigate("home");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" onClick={() => navigate("home")}>CodeBattle</div>
        <h2 className="login-title">로그인</h2>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <div className="login-field">
            <label className="login-label" htmlFor="login-userid">아이디</label>
            <input
              id="login-userid"
              className="login-input"
              type="text"
              placeholder="아이디를 입력하세요"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              autoComplete="username"
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

          <label className="login-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>로그인 상태 유지</span>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn login-btn--primary" type="submit">
            로그인
          </button>
        </form>

        <div className="login-divider"><span>또는</span></div>

        <button className="login-btn login-btn--dev" type="button" onClick={handleDevLogin}>
          개발자 로그인 (Debug)
        </button>

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
