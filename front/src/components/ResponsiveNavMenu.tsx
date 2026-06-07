import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../context/AppContext";
import ProfileBadge from "./ProfileBadge";
import "./ResponsiveNavMenu.css";

export interface NavTab {
  label: string;
  onClick: () => void;
  active?: boolean;
}

/**
 * 반응형 상단 메뉴.
 * - 넓은 화면: 아무것도 렌더하지 않음(기존 home-tab-nav/home-auth-area가 보임). 햄버거는 CSS로 숨김.
 * - 좁은 화면(<=880px): 기존 탭/프로필은 CSS로 숨겨지고, 이 햄버거만 표시.
 *   햄버거 클릭 시 우측 드로어(상단 프로필 + 세로 탭 목록)가 열림.
 */
const ResponsiveNavMenu: React.FC<{ tabs: NavTab[] }> = ({ tabs }) => {
  const { user, logout, navigate } = useApp();
  const [open, setOpen] = useState(false);

  // 드로어 열림 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const run = (fn: () => void) => { fn(); setOpen(false); };

  // 헤더의 스택 컨텍스트(z-index)에 갇히지 않도록 body로 포털 렌더 → 항상 최상단
  return createPortal(
    <>
      <button className="rnm-hamburger" onClick={() => setOpen(true)} aria-label="메뉴 열기">
        <span /><span /><span />
      </button>

      {open && (
        <div className="rnm-overlay" onClick={() => setOpen(false)}>
          <aside className="rnm-drawer" onClick={e => e.stopPropagation()}>
            {/* 상단: 프로필 정보 */}
            <div className="rnm-drawer-head">
              {user ? (
                <span className="rnm-profile"><ProfileBadge /></span>
              ) : (
                <span className="rnm-guest">
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => navigate("signup"))}>회원가입</button>
                  <button className="btn btn-primary btn-sm" onClick={() => run(() => navigate("login"))}>로그인</button>
                </span>
              )}
              <button className="rnm-close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            </div>

            {/* 하단: 탭 목록(일렬) */}
            <nav className="rnm-tablist">
              {tabs.map((t, i) => (
                <button
                  key={i}
                  className={`rnm-tab${t.active ? " rnm-tab--active" : ""}`}
                  onClick={() => run(t.onClick)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {user && (
              <button className="rnm-logout" onClick={() => run(() => logout())}>로그아웃</button>
            )}
          </aside>
        </div>
      )}
    </>,
    document.body,
  );
};

export default ResponsiveNavMenu;
