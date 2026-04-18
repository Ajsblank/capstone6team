import React from "react";
import { useApp } from "../context/AppContext";
import "../pages/AppLayout.css";

interface AppHeaderProps {
  /** 현재 활성 탭 (네비게이션 하이라이트용) */
  activePage?: "home" | "problems" | "contest" | "help";
  /** HomePage에서 홈 탭 클릭 시 내부 콘텐츠 전환 콜백 */
  onHomeClick?: () => void;
  /** HomePage에서 대회 탭 클릭 시 내부 콘텐츠 전환 콜백 */
  onContestClick?: () => void;
  /** HomePage에서 도움말 탭 클릭 시 내부 콘텐츠 전환 콜백 */
  onHelpClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  activePage,
  onHomeClick,
  onContestClick,
  onHelpClick,
}) => {
  const { user, logout, navigate } = useApp();

  return (
    <header className="home-header">
      <span className="home-logo" onClick={() => { onHomeClick?.(); navigate("home"); }}>
        ASAP 캡스톤
      </span>
      <nav className="home-tab-nav">
        <button
          className={`home-tab-btn${activePage === "home" ? " home-tab-btn--active" : ""}`}
          onClick={() => onHomeClick ? onHomeClick() : navigate("home")}
        >
          홈
        </button>
        <button
          className={`home-tab-btn${activePage === "problems" ? " home-tab-btn--active" : ""}`}
          onClick={() => navigate("problems")}
        >
          문제
        </button>
        <button
          className={`home-tab-btn${activePage === "contest" ? " home-tab-btn--active" : ""}`}
          onClick={() => onContestClick?.()}
        >
          대회
        </button>
        <button
          className={`home-tab-btn${activePage === "help" ? " home-tab-btn--active" : ""}`}
          onClick={() => onHelpClick?.()}
        >
          도움말
        </button>
      </nav>

      <div className="home-auth-area">
        <button
          className="home-auth-btn home-auth-btn--battle"
          onClick={() => navigate("battle")}
        >
          ⚔️ 코드 배틀
        </button>
        {user ? (
          <>
            <span className="home-username" onClick={() => navigate("profile")} title="프로필 보기">
              {user.username}
            </span>
            <button className="home-auth-btn home-auth-btn--secondary" onClick={() => navigate("account-settings")}>
              설정
            </button>
            <button className="home-auth-btn home-auth-btn--ghost" onClick={() => logout()}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <button className="home-auth-btn home-auth-btn--ghost" onClick={() => navigate("signup")}>
              회원가입
            </button>
            <button className="home-auth-btn home-auth-btn--primary" onClick={() => navigate("login")}>
              로그인
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
