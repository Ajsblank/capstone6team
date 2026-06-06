import React, { useEffect, useState } from "react";
import { ValidationResult } from "../api/validationApi";
import "./ValidationResultModal.css";

interface ValidationResultModalProps {
  isOpen: boolean;
  result: ValidationResult | null;
  isLoading: boolean;
  onClose: () => void;
  onRetry: () => void;
}

const ValidationResultModal: React.FC<ValidationResultModalProps> = ({
  isOpen,
  result,
  isLoading,
  onClose,
  onRetry,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    }
  }, [isOpen]);

  // 모달이 열려 있는 동안 배경(대회 페이지) 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  const failedItems = result?.details.filter(d => !d.passed) ?? [];
  const allPassed = result?.passed ?? false;

  return (
    <div className="vrm-overlay" onClick={onClose}>
      <div className="vrm-modal" onClick={e => e.stopPropagation()}>
        <div className="vrm-header">
          <h2 className="vrm-title">검증 결과</h2>
          <button className="vrm-close" onClick={onClose}>✕</button>
        </div>

        {isLoading ? (
          <div className="vrm-content vrm-loading">
            <div className="vrm-spinner"></div>
            <p>검증을 진행 중입니다...</p>
          </div>
        ) : result ? (
          <div className="vrm-content">
            {/* 검증 결과 요약 */}
            <div className={`vrm-summary vrm-summary--${allPassed ? 'success' : 'failure'}`}>
              <span className="vrm-summary-icon">
                {allPassed ? '✓' : '✕'}
              </span>
              <div className="vrm-summary-text">
                <p className="vrm-summary-title">
                  {allPassed ? '검증 성공' : '검증 실패'}
                </p>
                <p className="vrm-summary-desc">
                  {allPassed
                    ? '모든 항목이 검증되었습니다. 결제로 진행할 수 있습니다.'
                    : `${failedItems.length}개 항목이 검증에 실패했습니다.`
                  }
                </p>
              </div>
            </div>

            {/* 상세 결과 */}
            <div className="vrm-details">
              <div className="vrm-details-header">상세 결과</div>
              {result.details.map((detail, idx) => (
                <div key={idx} className={`vrm-detail-item vrm-detail-item--${detail.passed ? 'pass' : 'fail'}`}>
                  <div className="vrm-detail-header">
                    <span className="vrm-detail-status">
                      {detail.passed ? '✓ 통과' : '✕ 실패'}
                    </span>
                    <span className="vrm-detail-target">{detail.target}</span>
                  </div>

                  {!detail.passed && detail.reason && (
                    <div className="vrm-detail-reason">
                      <strong>사유:</strong> {detail.reason}
                    </div>
                  )}

                  {detail.log && (
                    <div className="vrm-detail-log">
                      <div className="vrm-detail-log-label">서버 로그</div>
                      <pre>{detail.log}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 버튼 */}
        <div className="vrm-footer">
          {!isLoading && result && (
            allPassed ? (
              <button className="vrm-btn vrm-btn-proceed" onClick={onClose} data-tut="validate-confirm">
                계속하기
              </button>
            ) : (
              <>
                <button className="vrm-btn vrm-btn-retry" onClick={onRetry}>
                  다시 검증
                </button>
                <button className="vrm-btn vrm-btn-close" onClick={onClose}>
                  닫기
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ValidationResultModal;
