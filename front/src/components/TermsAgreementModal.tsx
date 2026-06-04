import React, { useState, useEffect } from "react";
import { loadTerms, parseTermsIntoSections } from "../utils/termsLoader";
import "./TermsAgreementModal.css";

interface TermsAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  type?: 'contest-hosting' | 'contest-join' | 'privacy';
}

interface TermsSection {
  title: string;
  content: string;
}

const TermsAgreementModal: React.FC<TermsAgreementModalProps> = ({
  isOpen,
  onClose,
  onAgree,
  type = 'contest-hosting',
}) => {
  const [sections, setSections] = useState<TermsSection[]>([]);
  const [agreedSections, setAgreedSections] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // 배경 스크롤 방지
      document.body.style.overflow = 'hidden';

      setLoading(true);
      setError(null);
      setAgreedSections(new Set());

      loadTerms(type)
        .then(content => {
          const parsedSections = parseTermsIntoSections(content);
          setSections(parsedSections);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || "약관을 불러올 수 없습니다.");
          setLoading(false);
        });
    } else {
      // 모달 닫힐 때 배경 스크롤 복원
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, type]);

  if (!isOpen) return null;

  const handleSectionAgree = (index: number) => {
    const newSet = new Set(agreedSections);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setAgreedSections(newSet);
  };

  const allAgreed = sections.length > 0 && agreedSections.size === sections.length;

  const handleAgree = () => {
    if (!allAgreed) return;
    onAgree();
  };

  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, idx) => {
        // 굵은 텍스트
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        if (line.trim() === '') {
          return null;
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className="tam-section-subtitle">
              {line.replace(/^### /, '')}
            </h3>
          );
        }
        if (line.startsWith('- ')) {
          return (
            <li key={idx}>{line.replace(/^- /, '')}</li>
          );
        }
        return (
          <p key={idx} dangerouslySetInnerHTML={{ __html: line }} />
        );
      })
      .filter(Boolean);
  };

  return (
    <div className="tam-overlay" onClick={onClose}>
      <div className="tam-modal" onClick={e => e.stopPropagation()}>
        <div className="tam-header">
          <h2 className="tam-title">
            {type === 'contest-hosting' ? '대회 개최' :
             type === 'contest-join' ? '대회 참가' :
             '개인정보'}
          </h2>
          <button className="tam-close" onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div className="tam-content tam-loading">
            <span>약관을 불러오는 중...</span>
          </div>
        )}

        {error && (
          <div className="tam-content tam-error">
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && sections.length > 0 && (
          <div className="tam-content">
            {sections.map((section, idx) => (
              <div key={idx} className="tam-section">
                <div className="tam-section-header">
                  <input
                    type="checkbox"
                    className="tam-section-checkbox"
                    id={`section-${idx}`}
                    checked={agreedSections.has(idx)}
                    onChange={() => handleSectionAgree(idx)}
                  />
                  <label htmlFor={`section-${idx}`} className="tam-section-title">
                    {section.title}
                  </label>
                </div>
                <div className="tam-section-content">
                  {renderMarkdown(section.content)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="tam-footer">
          <div className="tam-buttons">
            <button className="tam-btn tam-btn-cancel" onClick={onClose}>
              동의하지 않음
            </button>
            <button
              className="tam-btn tam-btn-agree"
              onClick={handleAgree}
              disabled={!allAgreed || loading || !!error}
            >
              동의합니다
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAgreementModal;
