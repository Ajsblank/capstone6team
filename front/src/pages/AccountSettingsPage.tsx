import React from "react";
import { useApp } from "../context/AppContext";

const AccountSettingsPage: React.FC = () => {
  const { navigate } = useApp();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#ffffff",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "48px 16px",
      fontFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
      position: "relative",
    }}>
      {/* 우상단 오렌지 장식 */}
      <div style={{
        position: "fixed", top: 0, right: 0,
        width: "40vmin", height: "40vmin",
        clipPath: "polygon(100% 0, 100% 100%, 0 0)",
        background: "radial-gradient(ellipse at 100% 0%, rgba(234,88,12,0.13) 0%, rgba(234,88,12,0.04) 50%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        width: "100%", maxWidth: 520,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderTop: "3px solid #ea580c",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "18px 24px",
          borderBottom: "1px solid #f3f4f6",
          background: "#fffbf8",
        }}>
          <button
            style={{
              background: "none", border: "none", color: "#9ca3af",
              fontSize: "0.82rem", fontFamily: "inherit",
              cursor: "pointer", padding: 0, whiteSpace: "nowrap",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "#ea580c")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
            onClick={() => window.history.back()}
          >
            ← 이전으로
          </button>
          <h1 style={{
            flex: 1, margin: 0,
            fontSize: "1.05rem", fontWeight: 800,
            color: "#111827", letterSpacing: "-0.01em",
          }}>
            계정 설정
          </h1>
        </div>

        {/* 본문 */}
        <div style={{
          padding: "48px 24px 40px",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 12,
          textAlign: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "#fff7ed", border: "2px solid #fed7aa",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem",
          }}>⚙️</div>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#4b5563", fontWeight: 600 }}>
            준비 중입니다
          </p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#9ca3af", lineHeight: 1.6 }}>
            계정 설정 기능은 곧 제공될 예정입니다.
          </p>
          <button
            style={{
              marginTop: 12,
              background: "none",
              border: "1px solid #e5e7eb",
              color: "#6b7280",
              borderRadius: 8,
              padding: "8px 22px",
              fontFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "#9ca3af";
              e.currentTarget.style.color = "#374151";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.color = "#6b7280";
            }}
            onClick={() => window.history.back()}
          >
            ← 이전으로
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
