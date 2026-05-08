import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import "./LandingPage.css";

const BATTLE_FEATURES = [
  {
    icon: "🤖", title: "AI 실시간 대결",
    desc: "단순히 정답을 맞히는 게 아닙니다. 여러분의 코드가 상대방이 작성한 AI 코드와 직접 맞붙습니다. 매 턴마다 최선의 전략을 구사해 AI의 알고리즘을 압도하세요.",
    bullets: ["다양한 전략의 AI 봇 대전 상대", "대회별 고유한 규칙 및 승리 조건", "시각화 플레이 지원", "혼자서 플레이 모드 (솔로 연습)"],
  },  
  {
    icon: "📊", title: "실시간 리더보드",
    desc: "제출할 때마다 순위가 즉시 갱신됩니다. 승리 횟수, 점수, 효율성이 복합 반영되며 상위 랭커의 코드는 대회 종료 후 공개됩니다.",
    bullets: ["실시간 순위 갱신 (제출 즉시 반영)", "승리 횟수 / 점수 / 효율성 복합 산정", "상위 참가자 코드 열람 (대회 종료 후)", "제출 횟수 제한 없음"],
  },
  {
    icon: "🔧", title: "대회 직접 개최",
    desc: "누구나 대회를 설계하고 운영할 수 있습니다. 자신만의 채점 로직과 시각화 HTML을 업로드해 독창적인 코딩 배틀을 선보여보세요.",
    bullets: ["커스텀 채점 코드 업로드 (C++ / Java / Python)", "실시간 시각화 HTML 파일 지원", "참가자 수 / 시작·종료 일정 자유 설정"],
  },
];

const PS_FEATURES = [
  {
    icon: "🎯", title: "다양한 난이도",
    desc: "입문자부터 전문가까지 — 모든 실력에 맞는 문제가 준비되어 있습니다.",
    bullets: ["Bronze · Silver · Gold · Platinum 티어", "오답 원인 힌트 및 예외 케이스 안내", "Best Solution 코드 분석 기능"],
  },
  {
    icon: "⚡", title: "즉시 자동 채점",
    desc: "코드를 제출하는 순간, 강력한 채점 엔진이 작동합니다.",
    bullets: ["케이스별 실행 시간 / 메모리 사용량 분석", "전체 제출 기록 열람 및 비교", "Python · Java · C++ 지원"],
  },
  {
    icon: "📈", title: "실력 추적 & 통계",
    desc: "풀었던 모든 문제가 자동으로 기록되고 성장 곡선이 시각화됩니다.",
    bullets: ["문제 카테고리별 정복률 시각화", "주간 / 월간 활동 히트맵", "레이팅 변화 그래프"],
  },
];

const LandingPage: React.FC = () => {
  const { user, logout, navigate } = useApp();
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const onScroll = () => setIsAtTop(window.scrollY === 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="lp-page">

      {/* ── Header ── */}
      <header className="lp-header">
        <span className="lp-logo">
          <img src="/resources/logo/TacticalCodeBattle_logo.png" alt="TCB" className="lp-logo-img" />
        </span>
        <nav className="lp-nav">
          <button className="lp-nav-btn" onClick={() => navigate("battle")}>코드 배틀</button>
          <button className="lp-nav-btn" onClick={() => navigate("home")}>알고리즘 문제</button>
          <button className="lp-nav-btn">도움말</button>
          <button className="lp-nav-btn">문의</button>
        </nav>
        <div className="lp-auth">
          {user ? (
            <>
              <span className="lp-username" onClick={() => navigate("profile")}>{user.username}</span>
              <button className="lp-auth-btn lp-auth-btn--ghost" onClick={() => navigate("account-settings")}>설정</button>
              <button className="lp-auth-btn lp-auth-btn--ghost" onClick={() => logout()}>로그아웃</button>
            </>
          ) : (
            <>
              <button className="lp-auth-btn lp-auth-btn--ghost" onClick={() => navigate("signup")}>회원가입</button>
              <button className="lp-auth-btn lp-auth-btn--primary" onClick={() => { localStorage.setItem("loginRedirect", "landing"); navigate("login"); }}>로그인</button>
            </>
          )}
        </div>
      </header>

      {/* ── CodeBattle Hero ── */}
      <section className="lp-battle-hero">
        <div className="lp-battle-hero-inner">
          <h1 className="lp-battle-title">Tactical Code <br></br>Battle</h1>
          <p className="lp-battle-subtitle">나의 코드로 상대의 코드를 상대하는 코드 대결 — 나만의 전략으로 정상을 노려라</p>
          <button className="lp-battle-cta" onClick={() => navigate("battle")}>
            시작하기 
          </button>
        </div>
        <div className={`lp-scroll-hint${isAtTop ? "" : " lp-scroll-hint--hidden"}`}>스크롤하여 더 알아보기</div>
      </section>

      {/* ── CodeBattle Features (수직 배치) ── */}
      <section className="lp-battle-features">
        <div className="lp-features-inner">
          {BATTLE_FEATURES.map(({title, desc, bullets }, i) => (
            <div key={title} className={`lp-bf-row${i % 2 === 1 ? " lp-bf-row--reverse" : ""}`}>
              <div className="lp-bf-content">
                <h3 className="lp-bf-title">{title}</h3>
                <p className="lp-bf-desc">{desc}</p>
                <ul className="lp-bf-list">
                  {bullets.map(b => <li key={b}>{b}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 섹션 브릿지 (배틀 → PS 자연스러운 전환) ── */}
      <div className="lp-bridge">
        <div className="lp-bridge-inner">
          <span className="lp-bridge-tag lp-bridge-tag--battle">⚔️ 코드 배틀</span>
          <div className="lp-bridge-divider" />
          <p className="lp-bridge-copy">실전 감각은 배틀로, 기초 실력은 PS로</p>
          <div className="lp-bridge-divider" />
          <span className="lp-bridge-tag lp-bridge-tag--algo">📝 알고리즘 문제</span>
        </div>
      </div>

      {/* ── PS Section ── */}
      <section className="lp-ps-section">
        <div className="lp-ps-hero">
          <h2 className="lp-ps-title">알고리즘 문제 풀기</h2>
          <p className="lp-ps-subtitle">코딩 실력을 키우는 PS 서비스 — 탄탄한 기초가 배틀의 무기가 됩니다</p>
          <button className="lp-ps-cta" onClick={() => navigate("home")}>
            문제 풀러 가기 →
          </button>
        </div>

        <div className="lp-ps-features">
          {PS_FEATURES.map(({ title, desc, bullets }) => (
            <div key={title} className="lp-ps-card">
              <h3 className="lp-ps-card-title">{title}</h3>
              <p className="lp-ps-card-desc">{desc}</p>
              <ul className="lp-ps-card-list">
                {bullets.map(b => <li key={b}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
