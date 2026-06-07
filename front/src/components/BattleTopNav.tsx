import React from "react";
import { useApp } from "../context/AppContext";
import ProfileBadge from "./ProfileBadge";
import ResponsiveNavMenu from "./ResponsiveNavMenu";
import "../pages/AppLayout.css";

interface BattleTopNavProps {
  /** nav와 auth-area 사이 여백 (cc-* 레이아웃 페이지에서 사용) */
  spacer?: boolean;
  /** 로그인 버튼 클릭 시 현재 위치를 loginRedirect로 저장 후 이동 (BattleSubmitPage용) */
  saveLoginRedirect?: boolean;
}

/**
 * 대회 계열 페이지(개최/검수자설정/설정/참가) 상단 헤더.
 * 로고 + 대회/랭킹/이전문제/도움말/문의 탭 + 로그인 상태 영역.
 * 탭은 BattleHomePage로 이동 후 해시로 서브탭을 지정한다.
 * (BattleHomePage 자체는 내부 탭 전환·active 하이라이트가 있어 별도 구현)
 */
const BattleTopNav: React.FC<BattleTopNavProps> = ({ spacer, saveLoginRedirect }) => {
  const { user, logout, navigate } = useApp();

  const goSubTab = (sub: string) => {
    navigate("battle");
    window.location.hash = `battle/${sub}`;
  };

  const handleLogin = () => {
    if (saveLoginRedirect) {
      localStorage.setItem("loginRedirect", window.location.hash.replace("#", "") || "battle/contest");
    }
    navigate("login");
  };

  return (
    <header className="home-header">
      <span className="home-logo" onClick={() => navigate("landing")}>
        <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="home-logo-img" />
      </span>
      <nav className="home-tab-nav">
        <button className="home-tab-btn" onClick={() => navigate("battle")}>대회</button>
        <button className="home-tab-btn" onClick={() => goSubTab("ranking")}>랭킹</button>
        <button className="home-tab-btn" onClick={() => goSubTab("previous-problems")}>이전 문제</button>
        <button className="home-tab-btn" onClick={() => goSubTab("help")}>도움말</button>
        <button className="home-tab-btn" onClick={() => goSubTab("contact")}>문의</button>
      </nav>
      {spacer && <div className="cc-header-spacer" />}
      <div className="home-auth-area">
        {user ? (
          <>
            <ProfileBadge />
            <button className="btn btn-ghost btn-sm" onClick={() => logout()}>로그아웃</button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("signup")}>회원가입</button>
            <button className="btn btn-primary btn-sm" onClick={handleLogin}>로그인</button>
          </>
        )}
      </div>
      {/* 좁은 화면용 햄버거 + 드로어 (탭/프로필이 숨겨질 때 노출) */}
      <ResponsiveNavMenu tabs={[
        { label: "대회",      onClick: () => navigate("battle") },
        { label: "랭킹",      onClick: () => goSubTab("ranking") },
        { label: "이전 문제", onClick: () => goSubTab("previous-problems") },
        { label: "도움말",    onClick: () => goSubTab("help") },
        { label: "문의",      onClick: () => goSubTab("contact") },
      ]} />
    </header>
  );
};

export default BattleTopNav;
