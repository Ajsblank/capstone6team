import React, { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { autoLoginApi } from "../api/authApi";

const AutoLoginPage: React.FC = () => {
  const { login, navigate } = useApp();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = window.location.hash.split("/")[1];
    if (!token) { navigate("landing"); return; }

    autoLoginApi(token)
      .then(data => {
        login(
          { id: data.userId, username: data.userId, email: "" },
          data.joinedContests ?? [],
          data.hostedContests ?? [],
          data.createdContests ?? []
        );
        navigate("battle");
      })
      .catch(() => setError("초대 링크가 만료되었거나 유효하지 않습니다."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return (
    <div style={{ color: "#f87171", textAlign: "center", marginTop: 100 }}>
      {error}
    </div>
  );
  return (
    <div style={{ color: "#e2e8f0", textAlign: "center", marginTop: 100 }}>
      로그인 처리 중...
    </div>
  );
};

export default AutoLoginPage;
