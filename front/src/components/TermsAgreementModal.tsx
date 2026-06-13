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
  isOpen, onClose, onAgree, type = 'contest-hosting',
}) => {
  const [sections, setSections]           = useState<TermsSection[]>([]);
  const [agreedSections, setAgreedSections] = useState<Set<number>>(new Set());
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx]     = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setLoading(true);
      setError(null);
      setAgreedSections(new Set());
      setExpandedIdx(null);
      loadTerms(type)
        .then(content => { setSections(parseTermsIntoSections(content)); setLoading(false); })
        .catch(err => { setError(err.message || "약관을 불러올 수 없습니다."); setLoading(false); });
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, type]);

  if (!isOpen) return null;

  const handleSectionAgree = (index: number) => {
    const next = new Set(agreedSections);
    next.has(index) ? next.delete(index) : next.add(index);
    setAgreedSections(next);
  };

  const allAgreed = sections.length > 0 && agreedSections.size === sections.length;

  const renderMarkdown = (text: string) =>
    text.split('\n').map((line, idx) => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (!line.trim()) return null;
      if (line.startsWith('### '))
        return <h3 key={idx} className="tam-section-subtitle">{line.replace(/^### /, '')}</h3>;
      if (line.startsWith('- '))
        return <li key={idx}>{line.replace(/^- /, '')}</li>;
      return <p key={idx} dangerouslySetInnerHTML={{ __html: line }} />;
    }).filter(Boolean);

  const sectionClass = (idx: number) => {
    if (expandedIdx === null)  return "tam-section";
    if (expandedIdx === idx)   return "tam-section tam-section--expanded";
    return "tam-section tam-section--shrunk";
  };

  return (
    <div className="tam-overlay" onClick={onClose}>
      <div className="tam-modal" onClick={e => e.stopPropagation()}>

        <div className="tam-header">
          <h2 className="tam-title">
            {type === 'contest-hosting' ? '대회 개최' : type === 'contest-join' ? '대회 참가' : '개인정보'}
          </h2>
          <button className="tam-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="tam-content tam-loading"><span>약관을 불러오는 중...</span></div>}
        {error   && <div className="tam-content tam-error"><span>{error}</span></div>}

        {!loading && !error && sections.length > 0 && (
          <div className="tam-content">
            {sections.map((section, idx) => (
              <div key={idx} className={sectionClass(idx)}>
                <div className="tam-section-title-bar">
                  <span className="tam-section-title">{section.title}</span>
                  <button
                    className={`tam-expand-btn${expandedIdx === idx ? " tam-expand-btn--active" : ""}`}
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    {expandedIdx === idx ? "축소" : "확장"}
                  </button>
                </div>
                <div className="tam-section-content">
                  {renderMarkdown(section.content)}
                </div>
                <label htmlFor={`section-${idx}`} className="tam-section-agree">
                  <input
                    type="checkbox"
                    className="tam-section-checkbox"
                    id={`section-${idx}`}
                    checked={agreedSections.has(idx)}
                    onChange={() => handleSectionAgree(idx)}
                  />
                  <span className="tam-section-agree-text">위 내용을 확인했으며 동의합니다</span>
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="tam-footer">
          <div className="tam-buttons">
            <button className="tam-btn tam-btn-cancel" onClick={onClose}>동의하지 않음</button>
            <button className="tam-btn tam-btn-agree" onClick={() => allAgreed && onAgree()} disabled={!allAgreed || loading || !!error}>
              동의합니다
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAgreementModal;
