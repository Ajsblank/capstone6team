import React, { useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import "./LandingPage.css";

const LandingPage: React.FC = () => {
  const { user, logout, navigate } = useApp();
  const [mouseRatio, setMouseRatio] = useState(0.5);
  const [isMouseInside, setIsMouseInside] = useState(false);

  const algoProgress = Math.max(0, Math.min(1, (0.5 - mouseRatio) * 2));
  const battleProgress = Math.max(0, Math.min(1, (mouseRatio - 0.5) * 2));

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseRatio((e.clientX - rect.left) / rect.width);
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseRatio((e.clientX - rect.left) / rect.width);
    setIsMouseInside(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsMouseInside(false);
    setMouseRatio(0.5);
  }, []);

  const widthTransition = isMouseInside ? "none" : "width 0.45s cubic-bezier(0.4, 0, 0.2, 1)";
  const algoWidth = `calc(${50 + algoProgress * 50}% - ${algoProgress * 80}px)`;
  const battleWidth = `calc(${50 + battleProgress * 50}% - ${battleProgress * 80}px)`;

  const algoZIndex = algoProgress > 0 ? 3 : 2;
  const battleZIndex = battleProgress > 0 ? 3 : 1;

  const algoDetailOpacity = Math.min(1, algoProgress / 0.4);
  const battleDetailOpacity = Math.min(1, battleProgress / 0.4);

  return (
    <div className="lp-page">
      {/* ── Header ── */}
      <header className="lp-header">
        <span className="lp-logo">ASAP</span>
        <nav className="lp-nav">
          <button className="lp-nav-btn" onClick={() => navigate("home")}>알고리즘 문제</button>
          <button className="lp-nav-btn" onClick={() => navigate("battle")}>코드 배틀</button>
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

      {/* ── Main ── */}
      <main
        className="lp-main"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Algorithm Panel ── */}
        <section
          className="lp-panel lp-panel--algo"
          style={{ width: algoWidth, transition: widthTransition, zIndex: algoZIndex }}
          onClick={() => navigate("home")}
        >
          <div className="lp-panel-inner">
            <div className="lp-scroll">

              {/* Hero */}
              <div className="lp-hero">
                <div
                  className="lp-icon"
                  style={{ transform: `scale(${1 + algoProgress * 0.3})`, transition: "transform 0.2s ease" }}
                >
                  <span className={`lp-icon-inner${!isMouseInside ? " lp-icon-inner--float" : ""}`}>📝</span>
                </div>
                <h2 className="lp-title lp-title--algo">알고리즘 문제</h2>
                <p className="lp-subtitle">실력을 키우는 진짜 코딩 도전</p>
              </div>

              {/* Expanding details */}
              <div
                className="lp-details"
                style={{
                  opacity: algoDetailOpacity,
                  transform: `translateY(${(1 - algoDetailOpacity) * 24}px)`,
                  pointerEvents: algoDetailOpacity > 0.1 ? "auto" : "none",
                }}
              >
                <div className="lp-divider lp-divider--algo" />

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--algo">🎯 다양한 난이도</h3>
                  <p className="lp-section-body">
                    입문자부터 전문가까지 — 모든 실력에 맞는 문제가 준비되어 있습니다.
                    쉬운 문제로 기초를 탄탄하게 다지고, 어려운 문제로 한계를 돌파해보세요.
                    각 문제마다 명확한 난이도 지표와 풀이 힌트가 제공됩니다.
                  </p>
                  <div className="lp-badge-row">
                    <span className="lp-badge lp-badge--bronze">Bronze</span>
                    <span className="lp-badge lp-badge--silver">Silver</span>
                    <span className="lp-badge lp-badge--gold">Gold</span>
                    <span className="lp-badge lp-badge--platinum">Platinum</span>
                  </div>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--algo">⚡ 즉시 자동 채점</h3>
                  <p className="lp-section-body">
                    코드를 제출하는 순간, 강력한 채점 엔진이 작동합니다.
                    테스트 케이스별 상세 결과와 실행 시간, 메모리 사용량을 바로 확인할 수 있어
                    어느 부분에서 최적화가 필요한지 즉시 파악할 수 있습니다.
                  </p>
                  <ul className="lp-list">
                    <li>정확도 기반 다단계 채점 시스템</li>
                    <li>케이스별 실행 시간 / 메모리 사용량 분석</li>
                    <li>오답 원인 힌트 및 예외 케이스 안내</li>
                    <li>전체 제출 기록 열람 및 비교</li>
                    <li>Best Solution 코드 분석 기능</li>
                  </ul>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--algo">🌐 지원 언어</h3>
                  <p className="lp-section-body">
                    익숙한 언어로 바로 시작하세요. 주요 프로그래밍 언어를 모두 지원하며,
                    각 언어의 표준 라이브러리를 자유롭게 활용할 수 있습니다.
                  </p>
                  <div className="lp-lang-row">
                    {["Python 3", "Java 17", "C++17", "JavaScript", "TypeScript"].map((lang) => (
                      <span key={lang} className="lp-lang-tag">{lang}</span>
                    ))}
                  </div>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--algo">📊 실력 추적 & 통계</h3>
                  <p className="lp-section-body">
                    풀었던 모든 문제가 자동으로 기록됩니다. 내 실력 성장 곡선을 시각화하고,
                    취약한 알고리즘 분야를 집중적으로 훈련해 빠르게 레벨을 올릴 수 있습니다.
                  </p>
                  <ul className="lp-list">
                    <li>문제 카테고리별 정복률 시각화</li>
                    <li>주간 / 월간 활동 히트맵</li>
                    <li>레이팅 변화 그래프</li>
                    <li>나만의 코드 제출 히스토리 전체 열람</li>
                    <li>동일 문제 타 유저 코드 비교 (정복 후 공개)</li>
                  </ul>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--algo">🏆 알고리즘 카테고리</h3>
                  <p className="lp-section-body">
                    광범위한 카테고리에 걸쳐 엄선된 문제들이 준비되어 있습니다.
                    취약 분야를 발견하고 집중 공략하세요.
                  </p>
                  <div className="lp-cat-grid">
                    {[
                      "정렬 / 탐색", "그래프 이론", "동적 프로그래밍",
                      "이분 탐색", "백트래킹", "최단 경로",
                      "자료구조", "수학 / 정수론", "구현",
                      "그리디", "문자열", "트리",
                    ].map((cat) => (
                      <span key={cat} className="lp-cat-chip lp-cat-chip--algo">{cat}</span>
                    ))}
                  </div>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--algo">🎓 학습 로드맵</h3>
                  <p className="lp-section-body">
                    막막하게 시작할 필요 없습니다. 초보자를 위한 커리큘럼부터 고급 알고리즘 집중 코스까지,
                    단계별 학습 로드맵을 따라가면 어느새 실력이 쑥쑥 올라있을 것입니다.
                  </p>
                  <ul className="lp-list">
                    <li>레벨별 추천 문제 큐레이션</li>
                    <li>취약점 분석 기반 자동 문제 추천</li>
                    <li>알고리즘 개념 설명 내장 (위키 연동)</li>
                    <li>커뮤니티 풀이 공유 및 토론</li>
                  </ul>
                </section>
              </div>
            </div>

            {/* 하단 고정 클릭 힌트 */}
            <div className="lp-click-hint lp-click-hint--algo">
              클릭하여 시작
            </div>

            {/* Strip indicator (visible when battle is expanded) */}
            <div className={`lp-strip lp-strip--algo${battleProgress > 0.05 ? " lp-strip--visible" : ""}`}>
              <span>알고리즘</span>
            </div>
          </div>
        </section>

        {/* ── Battle Panel ── */}
        <section
          className="lp-panel lp-panel--battle"
          style={{ width: battleWidth, transition: widthTransition, zIndex: battleZIndex }}
          onClick={() => navigate("battle")}
        >
          <div className="lp-panel-inner">
            <div className="lp-scroll">

              {/* Hero */}
              <div className="lp-hero">
                <div
                  className="lp-icon"
                  style={{ transform: `scale(${1 + battleProgress * 0.3})`, transition: "transform 0.2s ease" }}
                >
                  <span className={`lp-icon-inner${!isMouseInside ? " lp-icon-inner--float" : ""}`}>⚔️</span>
                </div>
                <h2 className="lp-title lp-title--battle">코드 배틀</h2>
                <p className="lp-subtitle">AI 봇과 펼치는 실시간 코드 대결</p>
              </div>

              {/* Expanding details */}
              <div
                className="lp-details"
                style={{
                  opacity: battleDetailOpacity,
                  transform: `translateY(${(1 - battleDetailOpacity) * 24}px)`,
                  pointerEvents: battleDetailOpacity > 0.1 ? "auto" : "none",
                }}
              >
                <div className="lp-divider lp-divider--battle" />

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--battle">🤖 AI 봇 실시간 대결</h3>
                  <p className="lp-section-body">
                    단순히 정답을 맞히는 게 아닙니다. 여러분의 코드가 AI 봇과 직접 맞붙습니다.
                    매 턴마다 최선의 전략을 구사해 AI의 알고리즘을 압도하세요.
                    대회마다 새로운 판정 규칙과 게임 맵이 등장합니다.
                  </p>
                  <ul className="lp-list">
                    <li>다양한 전략의 AI 봇 대전 상대</li>
                    <li>대회별 고유한 규칙 및 승리 조건</li>
                    <li>실시간 시각화 플레이 지원</li>
                    <li>턴제 / 실시간 방식 모두 지원</li>
                    <li>혼자서 플레이 모드 (솔로 연습)</li>
                  </ul>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--battle">🎮 대회 형식</h3>
                  <p className="lp-section-body">
                    다양한 형태의 배틀 대회가 주기적으로 열립니다. 일반 대회부터 학교 공식
                    인증 대회까지, 목표에 맞는 대회를 선택해 도전해보세요.
                  </p>
                  <div className="lp-badge-row">
                    <span className="lp-badge lp-badge--purple">일반 대회</span>
                    <span className="lp-badge lp-badge--ranked">인증 대회</span>
                    <span className="lp-badge lp-badge--event">이벤트 대회</span>
                  </div>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--battle">📈 실시간 리더보드</h3>
                  <p className="lp-section-body">
                    제출할 때마다 순위가 갱신됩니다. 얼마나 많이, 얼마나 효율적으로
                    AI 봇을 이겼는지가 점수에 반영되며, 상위 랭커의 코드는 대회 종료 후 공개됩니다.
                  </p>
                  <ul className="lp-list">
                    <li>실시간 순위 갱신 (제출 즉시 반영)</li>
                    <li>승리 횟수 / 점수 / 효율성 복합 산정</li>
                    <li>상위 참가자 코드 열람 (대회 종료 후)</li>
                    <li>제출 횟수 제한 없음</li>
                    <li>최고 점수 기준 순위 산정</li>
                  </ul>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--battle">🏅 인증 대회 & 수료증</h3>
                  <p className="lp-section-body">
                    인증 대회는 공신력 있는 결과를 제공합니다. 성적 우수자에게는 디지털 수료증이
                    발급되어 프로필에 자동 기록되며, 기업 연계 채용 우대 혜택도 제공됩니다.
                  </p>
                  <ul className="lp-list">
                    <li>학교 공식 인증 대회 운영</li>
                    <li>순위권 디지털 수료증 자동 발급</li>
                    <li>프로필 명예 배지 획득</li>
                    <li>기업 연계 채용 우대 프로그램</li>
                    <li>인증 기간 내 재도전 무제한</li>
                  </ul>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--battle">🔧 직접 대회 개최</h3>
                  <p className="lp-section-body">
                    누구나 대회를 설계하고 운영할 수 있습니다. 자신만의 채점 로직과
                    시각화 HTML을 업로드해 독창적인 코딩 배틀을 선보여보세요.
                  </p>
                  <ul className="lp-list">
                    <li>커스텀 채점 코드 업로드 (Python / Java / C++)</li>
                    <li>실시간 시각화 HTML 파일 지원</li>
                    <li>혼자서 플레이 HTML 파일 지원</li>
                    <li>참가자 수 / 시작-종료 일정 자유 설정</li>
                    <li>대회 공개 / 비공개 설정 가능</li>
                  </ul>
                </section>

                <section className="lp-section">
                  <h3 className="lp-section-label lp-section-label--battle">✨ 전략 아이디어</h3>
                  <p className="lp-section-body">
                    단순한 그리디나 BFS도 강력한 무기가 될 수 있습니다.
                    어떤 전략이 AI를 꺾을 수 있을지 창의적으로 생각해보세요.
                    같은 문제를 다른 관점으로 접근하는 것이 핵심입니다.
                  </p>
                  <div className="lp-cat-grid">
                    {[
                      "그리디 전략", "탐색 최적화", "상태 압축",
                      "휴리스틱", "게임 트리", "확률 모델",
                      "시뮬레이션", "패턴 인식", "앙상블",
                    ].map((cat) => (
                      <span key={cat} className="lp-cat-chip lp-cat-chip--battle">{cat}</span>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            {/* 하단 고정 클릭 힌트 */}
            <div className="lp-click-hint lp-click-hint--battle">
              클릭하여 시작
            </div>

            {/* Strip indicator (visible when algo is expanded) */}
            <div className={`lp-strip lp-strip--battle${algoProgress > 0.05 ? " lp-strip--visible" : ""}`}>
              <span>코드 배틀</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
