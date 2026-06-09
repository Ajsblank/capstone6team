import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { loginApi, getUserId, setUsername } from "../api/authApi";
import { getMyProfile } from "../api/codeBattleApi";
import { setMyProfileCache } from "../components/ProfileBadge";
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
      setUsername(email);
      login(
        { id: uid ?? email, username: email, email },
        tokenData.joinedContests  ?? [],
        tokenData.hostedContests  ?? [],
        tokenData.createdContests ?? []
      );
      // 로그인 직후 프로필 조회 → 로그아웃 전까지 localStorage에서 재사용 (API 재호출 없음)
      getMyProfile().then(setMyProfileCache).catch(() => {});
      localStorage.removeItem("loginRedirect");
      navigate("landing");
    } catch (err: any) {
      const msg = err.response?.data?.message ?? "이메일 또는 비밀번호가 올바르지 않습니다.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo" onClick={() => navigate("landing")}>
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="login-logo-img" />
        </div>
        <h2 className="login-title">로그인</h2>

        <form className="login-form" onSubmit={handleLogin} noValidate>
          <div className="login-field">
            <label className="label" htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label className="label" htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={submitting}>
            {submitting ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="login-footer">
          <span className="login-footer-text">계정이 없으신가요?</span>
          <button className="login-link-btn" onClick={() => navigate("signup")}>
            회원가입
          </button>
        </div>

        <button className="login-back-btn" onClick={() => window.history.back()}>
          ← 이전으로
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
