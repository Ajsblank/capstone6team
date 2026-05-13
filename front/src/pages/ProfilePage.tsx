import React from "react";
import { useApp } from "../context/AppContext";

const ProfilePage: React.FC = () => {
  const { user, navigate } = useApp();

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#1e1e2e", fontFamily: "Segoe UI, sans-serif", gap: 16
    }}>
      <div style={{
        background: "#181825", border: "1px solid #313244", borderRadius: 14,
        padding: "40px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12
      }}>
        <div style={{ fontSize: "3rem" }}>👤</div>
        <h2 style={{ color: "#cdd6f4", margin: 0 }}>{user?.username ?? "로그인이 필요합니다"}</h2>
        {user?.email && <p style={{ color: "#6c7086", margin: 0, fontSize: "0.9rem" }}>{user.email}</p>}
        {user?.school && <p style={{ color: "#6c7086", margin: 0, fontSize: "0.9rem" }}>{user.school}</p>}
        <p style={{ color: "#45475a", fontSize: "0.85rem", marginTop: 8 }}>프로필 페이지 — 준비 중입니다.</p>
        <button
          style={{
            marginTop: 8, background: "none", border: "1px solid #45475a",
            color: "#a6adc8", borderRadius: 6, padding: "8px 20px",
            fontFamily: "Segoe UI, sans-serif", cursor: "pointer", fontSize: "0.9rem"
          }}
          onClick={() => navigate("home")}
        >
          ← 홈으로
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
