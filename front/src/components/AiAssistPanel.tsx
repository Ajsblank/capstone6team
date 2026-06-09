import React, { useState, useRef, useEffect } from "react";
import {
  generateIOFormat,
  generateJudgeCode,
  generateSkeletonCode,
  generateExampleAICode,
  generateVisualHtml,
  stripHtml,
} from "../api/geminiApi";
import "./AiAssistPanel.css";

const HAS_KEY = !!process.env.REACT_APP_GEMINI_API_KEY;

type Tab = "pipeline" | "html";

const LANGUAGES = ["Python", "C++", "Java", "JavaScript"];

const STEPS = [
  { num: 1, label: "입출력 형식" },
  { num: 2, label: "채점 코드" },
  { num: 3, label: "스켈레톤 코드" },
  { num: 4, label: "예시 AI 코드" },
];

interface Props {
  description: string;
  sampleCode: File | null;
  onApplySampleCode:    (f: File) => void;
  onApplyJudgeCode:     (f: File) => void;
  onAddExampleAICode:   (f: File) => void;
  onApplyVisualization: (f: File) => void;
  onApplySoloPlay:      (f: File) => void;
}

function extractCode(raw: string): string {
  const fenced = raw.match(/```(?:\w*\n)?([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

function extractHtml(raw: string): string {
  const fenced = raw.match(/```(?:html\n)?([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.trim();
  const idx = candidate.indexOf("<!DOCTYPE");
  return idx >= 0 ? candidate.slice(idx) : candidate;
}

function makeFile(content: string, name: string, type = "text/plain"): File {
  return new File([content], name, { type });
}

const AiAssistPanel: React.FC<Props> = ({
  description,
  sampleCode,
  onApplySampleCode,
  onApplyJudgeCode,
  onAddExampleAICode,
  onApplyVisualization,
  onApplySoloPlay,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab]           = useState<Tab>("pipeline");
  const [lang, setLang]         = useState("Python");
  const [step, setStep]         = useState(1);

  // 파이프라인 단계별 출력 (편집 가능)
  const [ioFormat,     setIoFormat]     = useState("");
  const [judgeOutput,  setJudgeOutput]  = useState("");
  const [skelOutput,   setSkelOutput]   = useState("");
  const [aiOutput,     setAiOutput]     = useState("");
  const [strategy,     setStrategy]     = useState("");

  const [streaming,    setStreaming]     = useState(false);
  const [pipeError,    setPipeError]     = useState("");

  // HTML 탭
  const [htmlOutput,   setHtmlOutput]   = useState("");
  const [htmlStreaming, setHtmlStreaming] = useState(false);
  const [htmlGenMode,  setHtmlGenMode]  = useState<"visualization" | "solo">("visualization");
  const [htmlError,    setHtmlError]    = useState("");

  const outputBoxRef = useRef<HTMLTextAreaElement>(null);
  const htmlBoxRef   = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!sampleCode) return;
    const ext = sampleCode.name.split(".").pop()?.toLowerCase();
    if      (ext === "py")                 setLang("Python");
    else if (ext === "cpp" || ext === "c") setLang("C++");
    else if (ext === "java")               setLang("Java");
    else if (ext === "js" || ext === "ts") setLang("JavaScript");
  }, [sampleCode]);

  const scrollBottom = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  };

  // ── 파이프라인 각 단계 생성 ──
  const handleGenerate = async () => {
    const plain = stripHtml(description);
    if (!plain) { setPipeError("문제 설명을 먼저 입력해주세요."); return; }
    setPipeError("");
    setStreaming(true);

    const onChunk = () => scrollBottom(outputBoxRef);

    try {
      if (step === 1) {
        setIoFormat("");
        let acc = "";
        await generateIOFormat(plain, (chunk) => { acc += chunk; setIoFormat(acc); onChunk(); });
      } else if (step === 2) {
        if (!ioFormat.trim()) { setPipeError("1단계 입출력 형식을 먼저 생성하세요."); return; }
        setJudgeOutput("");
        let acc = "";
        await generateJudgeCode(plain, ioFormat, (chunk) => { acc += chunk; setJudgeOutput(acc); onChunk(); });
      } else if (step === 3) {
        if (!judgeOutput.trim()) { setPipeError("2단계 채점 코드를 먼저 생성하세요."); return; }
        setSkelOutput("");
        let acc = "";
        await generateSkeletonCode(ioFormat, judgeOutput, lang, (chunk) => { acc += chunk; setSkelOutput(acc); onChunk(); });
      } else if (step === 4) {
        if (!skelOutput.trim()) { setPipeError("3단계 스켈레톤 코드를 먼저 생성하세요."); return; }
        setAiOutput("");
        let acc = "";
        await generateExampleAICode(skelOutput, strategy, lang, (chunk) => { acc += chunk; setAiOutput(acc); onChunk(); });
      }
    } catch (e: unknown) {
      setPipeError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setStreaming(false);
    }
  };

  const handleGenerateHtml = async (mode: "visualization" | "solo") => {
    const plain = stripHtml(description);
    if (!plain) { setHtmlError("문제 설명을 먼저 입력해주세요."); return; }
    setHtmlGenMode(mode); setHtmlOutput(""); setHtmlError(""); setHtmlStreaming(true);
    let sampleContent = "";
    if (sampleCode) { try { sampleContent = await sampleCode.text(); } catch { /* ignore */ } }
    try {
      let acc = "";
      await generateVisualHtml(plain, sampleContent, mode, (chunk) => {
        acc += chunk; setHtmlOutput(acc); scrollBottom(htmlBoxRef);
      });
    } catch (e: unknown) {
      setHtmlError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setHtmlStreaming(false);
    }
  };

  // ── 현재 단계의 출력값 ──
  const currentOutput = () => {
    if (step === 1) return ioFormat;
    if (step === 2) return judgeOutput;
    if (step === 3) return skelOutput;
    return aiOutput;
  };
  const setCurrentOutput = (v: string) => {
    if (step === 1) setIoFormat(v);
    else if (step === 2) setJudgeOutput(v);
    else if (step === 3) setSkelOutput(v);
    else setAiOutput(v);
  };
  const hasOutput = currentOutput().trim().length > 0;

  // ── 단계별 적용 버튼 ──
  const ApplyButtons: React.FC = () => {
    const ext = lang === "Python" ? "py" : lang === "C++" ? "cpp" : lang === "Java" ? "java" : "js";
    if (step === 2) {
      const clean = extractCode(judgeOutput);
      return (
        <button className="aip-apply-btn" onClick={() => onApplyJudgeCode(makeFile(clean, `judge.${ext}`))}>
          ↳ 채점 코드로 적용
        </button>
      );
    }
    if (step === 3) {
      const clean = extractCode(skelOutput);
      return (
        <button className="aip-apply-btn" onClick={() => onApplySampleCode(makeFile(clean, `skeleton.${ext}`))}>
          ↳ 샘플 코드로 적용
        </button>
      );
    }
    if (step === 4) {
      const clean = extractCode(aiOutput);
      return (
        <button className="aip-apply-btn" onClick={() => onAddExampleAICode(makeFile(clean, `ai_example.${ext}`))}>
          ↳ 예시 AI 코드로 추가
        </button>
      );
    }
    return null;
  };

  return (
    <div className={`aip-root${expanded ? " aip-root--expanded" : ""}`}>

      {/* 접힌 탭 */}
      {!expanded && (
        <div className="aip-side-tab" onClick={() => setExpanded(true)}>
          <span className="aip-side-icon">✦</span>
          <span className="aip-side-label">AI 도우미</span>
        </div>
      )}

      {/* 펼친 헤더 */}
      {expanded && (
        <div className="aip-header" onClick={() => setExpanded(false)}>
          <span className="aip-header-icon">✦</span>
          <span className="aip-header-title">AI 도우미</span>
          <button className="aip-header-close" onClick={(e) => { e.stopPropagation(); setExpanded(false); }}>✕</button>
        </div>
      )}

      <div className="aip-body">
        {!HAS_KEY && (
          <div className="aip-no-key">
            <code>REACT_APP_GEMINI_API_KEY</code>를<br />.env에 설정해주세요.
          </div>
        )}

        {/* 탭 */}
        <div className="aip-tabs">
          <button className={`aip-tab${tab === "pipeline" ? " aip-tab--active" : ""}`} onClick={() => setTab("pipeline")}>코드 생성</button>
          <button className={`aip-tab${tab === "html"     ? " aip-tab--active" : ""}`} onClick={() => setTab("html")}>시각화 HTML</button>
        </div>

        {/* ── 파이프라인 탭 ── */}
        {tab === "pipeline" && (
          <div className="aip-tab-panel">

            {/* 언어 선택 */}
            <div className="aip-controls">
              <select className="aip-select" value={lang} onChange={e => setLang(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* 단계 표시 */}
            <div className="aip-steps">
              {STEPS.map(s => (
                <button
                  key={s.num}
                  className={`aip-step-btn${step === s.num ? " aip-step-btn--active" : ""}${
                    (s.num === 1 ? ioFormat : s.num === 2 ? judgeOutput : s.num === 3 ? skelOutput : aiOutput).trim()
                      ? " aip-step-btn--done" : ""
                  }`}
                  onClick={() => { setStep(s.num); setPipeError(""); }}
                >
                  <span className="aip-step-num">{s.num}</span>
                  <span className="aip-step-label">{s.label}</span>
                </button>
              ))}
            </div>

            {/* 4단계: 전략 입력 */}
            {step === 4 && (
              <textarea
                className="aip-strategy-input"
                placeholder="구현할 전략을 입력하세요. (예: 탐욕 알고리즘, 미니맥스, 휴리스틱...)"
                value={strategy}
                onChange={e => setStrategy(e.target.value)}
                rows={3}
              />
            )}

            {pipeError && <div className="aip-error">{pipeError}</div>}

            {/* 생성 버튼 */}
            <button className="aip-gen-btn aip-gen-btn--full" onClick={handleGenerate} disabled={streaming || !HAS_KEY}>
              {streaming ? "생성 중..." : `${step}단계 생성`}
            </button>

            {/* 출력 박스 (편집 가능) */}
            <textarea
              className="aip-output-textarea"
              ref={outputBoxRef}
              value={currentOutput()}
              onChange={e => setCurrentOutput(e.target.value)}
              placeholder={`${STEPS[step - 1].label} 결과가 여기에 표시됩니다.\n생성 후 직접 수정할 수 있습니다.`}
            />

            {/* 적용 버튼 */}
            {hasOutput && !streaming && (
              <div className="aip-apply-row">
                <ApplyButtons />
                {step < 4 && (
                  <button className="aip-next-step-btn" onClick={() => { setStep(s => s + 1); setPipeError(""); }}>
                    다음 단계 →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 시각화 HTML 탭 ── */}
        {tab === "html" && (
          <div className="aip-tab-panel">
            <div className="aip-controls">
              <button className="aip-gen-btn aip-gen-btn--html" onClick={() => handleGenerateHtml("visualization")} disabled={htmlStreaming || !HAS_KEY}>
                {htmlStreaming && htmlGenMode === "visualization" ? "생성 중..." : "시각화 생성"}
              </button>
              <button className="aip-gen-btn aip-gen-btn--html" onClick={() => handleGenerateHtml("solo")} disabled={htmlStreaming || !HAS_KEY}>
                {htmlStreaming && htmlGenMode === "solo" ? "생성 중..." : "혼자 하기 생성"}
              </button>
            </div>
            {htmlError && <div className="aip-error">{htmlError}</div>}
            <pre className="aip-output-box" ref={htmlBoxRef}>
              {htmlOutput
                ? <>{htmlOutput}{htmlStreaming && <span className="aip-cursor" />}</>
                : <span className="aip-output-placeholder">생성된 HTML이 여기에 표시됩니다.</span>}
            </pre>
            {htmlOutput.trim() && !htmlStreaming && (
              <div className="aip-apply-row">
                <button className="aip-apply-btn" onClick={() => onApplyVisualization(makeFile(extractHtml(htmlOutput), "visualization.html", "text/html"))}>↳ 시각화 HTML로 적용</button>
                <button className="aip-apply-btn" onClick={() => onApplySoloPlay(makeFile(extractHtml(htmlOutput), "solo_play.html", "text/html"))}>↳ 혼자서 하기 HTML로 적용</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiAssistPanel;
