import React from "react";
import { SUBMIT_URL } from "../api/codeBattleApi";
import "./SubmitBar.css";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface Props {
  status: SubmitStatus;
  errorMessage?: string;
  onSubmit: () => void;
}

const STATUS_MESSAGE: Record<SubmitStatus, string> = {
  idle: "",
  submitting: "제출 중...",
  success: "제출 완료! 채점 결과를 기다리는 중입니다.",
  error: "제출에 실패했습니다. 다시 시도해주세요.",
};

const SubmitBar: React.FC<Props> = ({ status, errorMessage, onSubmit }) => {
  return (
    <div className="submit-bar">
      <span className="submit-url">서버: {SUBMIT_URL}</span>
      {status !== "idle" && (
        <span className={`submit-status submit-status--${status}`}>
          {status === "error" && errorMessage ? errorMessage : STATUS_MESSAGE[status]}
        </span>
      )}
      <button
        className="submit-btn"
        onClick={onSubmit}
        disabled={status === "submitting"}
      >
        {status === "submitting" ? "제출 중..." : "제출하기"}
      </button>
    </div>
  );
};

export default SubmitBar;
