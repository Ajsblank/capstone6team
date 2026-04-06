import React from "react";
import "./SubmitSuccessModal.css";

interface Props {
  message: string;
  onClose: () => void;
}

const SubmitSuccessModal: React.FC<Props> = ({ message, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">✓</div>
        <h2 className="modal-title">코드 제출이 완료되었습니다</h2>
        <p className="modal-desc">{message}</p>
        <button className="modal-btn" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
};

export default SubmitSuccessModal;
