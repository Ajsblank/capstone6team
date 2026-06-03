import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import "./ContestTutorial.css";

// ─── 튜토리얼 파일 ──────────────────────────────────────────────────────────────
export type TutFileKind = "desc" | "sample" | "judge" | "example" | "logviz" | "solo";

interface TutFile { id: TutFileKind; kind: string; ext: string; }
const DISPLAY_PREFIX = "[튜토리얼]_사과게임_";
const TUT_FILES: TutFile[] = [
  { id: "desc",    kind: "대회설명",   ext: "md"   },
  { id: "sample",  kind: "샘플AI코드", ext: "cpp"  },
  { id: "judge",   kind: "채점코드",   ext: "cpp"  },
  { id: "example", kind: "예시AI코드", ext: "cpp"  },
  { id: "logviz",  kind: "로그시각화", ext: "html" },
  { id: "solo",    kind: "혼자플레이", ext: "html" },
];
const fileName = (f: TutFile) => `${DISPLAY_PREFIX}${f.kind}.${f.ext}`;

// ─── 외부에서 받는 폼 상태 스냅샷 ────────────────────────────────────────────────
export interface TutSnapshot {
  title: string;
  certification: boolean;
  descFilled: boolean;
  timeLimitSec: number;
  memoryLimitMb: number;
  sampleUploaded: boolean;
  judgeUploaded: boolean;
  exampleUploaded: boolean;
  vizUploaded: boolean;
  soloUploaded: boolean;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  previewOpened: boolean;
  created: boolean;
}

interface Props {
  snap: TutSnapshot;
  previewOpen: boolean;
  applyFile: (kind: TutFileKind) => void;
  setUncertified: () => void;
  onFinish: () => void;
}

// ─── 타이핑 효과 (마크업 제외 plain 길이 기준) ──────────────────────────────────
const stripBold = (s: string) => s.replace(/\*\*/g, "");

function useTypewriter(markup: string, speed = 40) {
  const plain = stripBold(markup);
  const [len, setLen] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setLen(0); setDone(false);
    let i = 0;
    const t = setInterval(() => {
      i++; setLen(i);
      if (i >= plain.length) { clearInterval(t); setDone(true); }
    }, speed);
    return () => clearInterval(t);
  }, [markup, speed]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = useCallback(() => { setLen(plain.length); setDone(true); }, [plain.length]);
  return { len, done, skip };
}

// `**중요**` 구간을 볼드로, 타이핑된 길이(shownLen)까지만 렌더
function renderTyped(markup: string, shownLen: number): React.ReactNode[] {
  const parts = markup.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  const nodes: React.ReactNode[] = [];
  let consumed = 0;
  for (let p = 0; p < parts.length; p++) {
    if (consumed >= shownLen) break;
    const part = parts[p];
    const bold = part.startsWith("**") && part.endsWith("**");
    const raw = bold ? part.slice(2, -2) : part;
    const take = raw.slice(0, shownLen - consumed);
    consumed += raw.length;
    if (!take) continue;
    nodes.push(bold ? <strong key={p} className="ct-em">{take}</strong> : <span key={p}>{take}</span>);
  }
  return nodes;
}

// ─── 날짜 유틸 ──────────────────────────────────────────────────────────────────
function plusDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const dateOnly = (dt: string) => (dt ? dt.split("T")[0] : "");

// ─── 스텝 정의 ──────────────────────────────────────────────────────────────────
type Placement = "center" | "bottom" | "top" | "left" | "right";
interface Step {
  text: string;
  target: string | null;       // data-tut 값
  placement: Placement;
  dropKind?: TutFileKind | TutFileKind[];  // 드롭 실전
  isComplete?: (s: TutSnapshot) => boolean;
  hint?: string;
  auto?: "uncertified";
}

const STEPS: Step[] = [
  { target: null, placement: "center",
    text: "대회 개최 튜토리얼에 오신 것을 환영합니다. 이번 튜토리얼에서는 대회 개최 과정을 차근차근 이해하고, 미리 준비된 **‘사과 게임’ 명세**로 직접 대회를 개최해보겠습니다." },

  { target: "title", placement: "bottom",
    text: "먼저 **‘대회 이름’** 항목입니다. 개최하려는 대회의 이름을 적는 곳이에요. **원하는 이름**을 자유롭게 입력해보세요.",
    hint: "대회 이름을 입력하면 다음으로 진행할 수 있어요.",
    isComplete: s => s.title.trim().length > 0 },

  { target: "cert", placement: "bottom", auto: "uncertified",
    text: "**‘인증 / 비인증’** 설정입니다. 인증 대회는 시각화·혼자서 하기 파일을 **필수**로 요구하며 개최비가 **10만원**, 비인증은 **1만원**입니다. 튜토리얼에서는 **비인증 대회**로 진행하도록 자동 설정했습니다." },

  { target: "checklist", placement: "left",
    text: "오른쪽은 **‘개최 체크리스트’**입니다. **필수 항목**이 모두 채워졌는지 한눈에 확인할 수 있어, 빠뜨린 항목 없이 개최를 준비할 수 있습니다." },

  { target: "desc", placement: "top", dropKind: "desc",
    text: "**‘문제 설명’** 영역입니다. 참가자가 게임 규칙을 정확히 이해할 수 있도록 작성하는 곳이에요. 왼쪽 보관함의 **‘대회설명’ 파일**을 강조된 영역으로 끌어다 놓아보세요.",
    hint: "왼쪽의 [대회설명] 파일을 드래그해 강조 영역에 놓으세요.",
    isComplete: s => s.descFilled },

  { target: "limit", placement: "bottom",
    text: "**‘시간 제한’**과 **‘메모리 제한’**입니다. 참가자 코드가 한 수를 결정할 때 허용되는 시간과 메모리를 정합니다. 시간 제한은 **2초**, 메모리 제한은 **128MB**로 맞춰보세요.",
    hint: "시간 제한 = 2초, 메모리 제한 = 128MB 로 설정하세요.",
    isComplete: s => s.timeLimitSec === 2 && s.memoryLimitMb === 128 },

  { target: "sample", placement: "bottom", dropKind: "sample",
    text: "이제 파일 업로드입니다. **‘샘플 AI 코드’**는 참가자에게 제공되는 **기본 템플릿**으로, 참가자는 이를 토대로 자신만의 전략을 구현합니다. 왼쪽의 **‘샘플AI코드’ 파일**을 끌어다 놓아보세요.",
    hint: "왼쪽의 [샘플AI코드] 파일을 드래그해 놓으세요.",
    isComplete: s => s.sampleUploaded },

  { target: "judge", placement: "bottom", dropKind: "judge",
    text: "**‘채점 코드’**입니다. 두 AI를 직접 실행하며 게임을 진행하고 승패를 판정하는 **심판 코드**로, 참가자에게는 **공개되지 않습니다**. 왼쪽의 **‘채점코드’ 파일**을 끌어다 놓아보세요.",
    hint: "왼쪽의 [채점코드] 파일을 드래그해 놓으세요.",
    isComplete: s => s.judgeUploaded },

  { target: "example", placement: "bottom", dropKind: "example",
    text: "**‘예시 AI 코드’**입니다. 참가자가 제출한 코드와 대결할 **기준 AI**로, 대회의 **난이도**를 결정하는 상대가 됩니다. 왼쪽의 **‘예시AI코드’ 파일**을 끌어다 놓아보세요.",
    hint: "왼쪽의 [예시AI코드] 파일을 드래그해 놓으세요.",
    isComplete: s => s.exampleUploaded },

  { target: "viz", placement: "top", dropKind: ["logviz", "solo"],
    text: "**‘시각화 파일’**입니다. **로그 시각화**는 대결 로그를 턴별로 재생해 보여주고, **혼자서 하기**는 참가자가 게임을 직접 체험하게 해줍니다. 왼쪽의 **두 시각화 파일을 모두** 끌어다 놓아보세요.",
    hint: "왼쪽의 [로그시각화]와 [혼자플레이] 파일을 모두 놓으세요.",
    isComplete: s => s.vizUploaded && s.soloUploaded },

  { target: "date", placement: "top",
    text: `**‘대회 시작·종료 일시’** 설정입니다. 시작일은 오늘로부터 **2일 뒤(${plusDays(2)})**, 종료일은 **7일 뒤(${plusDays(7)})**로 맞춰보세요. 시간은 자유롭게 두어도 됩니다.`,
    hint: `시작일 ${plusDays(2)}, 종료일 ${plusDays(7)} 로 설정하세요.`,
    isComplete: s => dateOnly(s.startDate) === plusDays(2) && dateOnly(s.endDate) === plusDays(7) },

  { target: "max", placement: "top",
    text: "**‘최대 참가자 수’**입니다. 대회에 참가할 수 있는 인원의 상한을 정합니다. 최대 참가자 수를 **30명**으로 맞춰보세요.",
    hint: "최대 참가자 수 = 30 으로 설정하세요.",
    isComplete: s => s.maxParticipants === 30 },

  { target: "checklist", placement: "left",
    text: "필요한 정보 입력과 파일 업로드를 **모두 마쳤습니다**. 체크리스트의 모든 항목이 채워진 것을 확인할 수 있어요." },

  { target: "preview", placement: "top",
    text: "**‘미리보기’**로 실제 대회 페이지가 **참가자에게 어떻게 보이는지** 확인할 수 있습니다. 미리보기 버튼을 눌러 탭을 둘러본 뒤, **닫기 버튼**으로 돌아오세요.",
    hint: "미리보기 버튼을 누르고, 둘러본 뒤 닫기를 누르세요.",
    isComplete: s => s.previewOpened },

  { target: "create", placement: "top",
    text: "마지막으로 **‘대회 생성’** 버튼을 눌러 개최를 완성합니다. (튜토리얼이므로 **실제로 개최되거나 결제되지는 않습니다**.)",
    hint: "대회 생성 버튼을 눌러보세요.",
    isComplete: s => s.created },

  { target: null, placement: "center",
    text: "이상으로 대회 개최 튜토리얼을 마칩니다. 이제 여러분만의 아이디어가 담긴 게임으로 **멋진 대회를 개최**해보세요!" },
];

// ─── 블러 마스크 (rect 변경 시에만 리렌더 — 타이핑 리렌더와 분리) ────────────────
const PAD = 8;
const BlurMask = React.memo<{ rect: DOMRect }>(({ rect }) => (
  <>
    <div className="ct-blur" style={{ left: 0, top: 0, width: "100%", height: Math.max(0, rect.top - PAD) }} />
    <div className="ct-blur" style={{ left: 0, top: rect.bottom + PAD, width: "100%", height: Math.max(0, window.innerHeight - (rect.bottom + PAD)) }} />
    <div className="ct-blur" style={{ left: 0, top: rect.top - PAD, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 }} />
    <div className="ct-blur" style={{ left: rect.right + PAD, top: rect.top - PAD, width: Math.max(0, window.innerWidth - (rect.right + PAD)), height: rect.height + PAD * 2 }} />
    <div className="ct-frame" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
  </>
), (a, b) => a.rect === b.rect);
BlurMask.displayName = "BlurMask";

// ─── 메인 ──────────────────────────────────────────────────────────────────────
const ContestTutorial: React.FC<Props> = ({ snap, previewOpen, applyFile, setUncertified, onFinish }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const { len, done, skip } = useTypewriter(step.text);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [dropActive, setDropActive] = useState(false);

  // auto 액션
  useEffect(() => {
    if (step.auto === "uncertified") setUncertified();
  }, [stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // 타겟 위치 측정
  useEffect(() => {
    if (!step.target) { setRect(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-tut="${step.target}"]`);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    let raf = 0;
    const measure = () => setRect(el.getBoundingClientRect());
    const t = setTimeout(measure, 380);
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      clearTimeout(t); cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const practiceComplete = useMemo(
    () => (step.isComplete ? step.isComplete(snap) : true),
    [step, snap],
  );
  const canNext = done && practiceComplete;
  const isLast = stepIdx === STEPS.length - 1;

  const goNext = () => {
    if (!canNext) return;
    if (isLast) { onFinish(); return; }
    setStepIdx(i => i + 1);
  };

  // 드롭 처리
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const id = e.dataTransfer.getData("fileId") as TutFileKind;
    if (!step.dropKind) return;
    const allowed = Array.isArray(step.dropKind) ? step.dropKind : [step.dropKind];
    if (allowed.includes(id)) applyFile(id);
  };

  const dropKinds = step.dropKind ? (Array.isArray(step.dropKind) ? step.dropKind : [step.dropKind]) : [];
  const isDragTarget = (k: TutFileKind) => dropKinds.includes(k);

  // ── 말풍선 위치 계산 ──
  const pad = PAD;
  const bubbleW = 380;
  const gap = 18;
  let bubbleStyle: React.CSSProperties = {};
  let connector: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (rect) {
    const cx = rect.left + rect.width / 2;
    if (step.placement === "top") {
      const top = rect.top - gap;
      bubbleStyle = { left: Math.min(Math.max(cx - bubbleW / 2, 16), window.innerWidth - bubbleW - 16), bottom: window.innerHeight - top, width: bubbleW };
      connector = { x1: cx, y1: rect.top - pad, x2: cx, y2: top };
    } else if (step.placement === "left") {
      bubbleStyle = { right: window.innerWidth - rect.left + gap, top: Math.max(rect.top, 16), width: bubbleW };
      connector = { x1: rect.left - pad, y1: rect.top + rect.height / 2, x2: rect.left - gap, y2: rect.top + rect.height / 2 };
    } else if (step.placement === "right") {
      bubbleStyle = { left: rect.right + gap, top: Math.max(rect.top, 16), width: bubbleW };
      connector = { x1: rect.right + pad, y1: rect.top + rect.height / 2, x2: rect.right + gap, y2: rect.top + rect.height / 2 };
    } else {
      const top = rect.bottom + gap;
      bubbleStyle = { left: Math.min(Math.max(cx - bubbleW / 2, 16), window.innerWidth - bubbleW - 16), top, width: bubbleW };
      connector = { x1: cx, y1: rect.bottom + pad, x2: cx, y2: top };
    }
  }

  const bubbleInner = (
    <>
      <div className="ct-bubble-step">STEP {stepIdx} / {STEPS.length - 1}</div>
      <p className="ct-bubble-text" onClick={skip}>
        {renderTyped(step.text, len)}{!done && <span className="ct-cursor">▋</span>}
      </p>
      {done && step.isComplete && !practiceComplete && step.hint && (
        <p className="ct-bubble-hint">👉 {step.hint}</p>
      )}
      {done && step.isComplete && practiceComplete && (
        <p className="ct-bubble-ok">✓ 완료했습니다!</p>
      )}
      <div className="ct-bubble-actions">
        {!done ? (
          <button className="ct-skip" onClick={skip}>건너뛰기 ▶▶</button>
        ) : (
          <button className="ct-next" disabled={!canNext} onClick={goNext}>
            {isLast ? "튜토리얼 완료" : canNext ? "다음 →" : "위 항목을 완료하세요"}
          </button>
        )}
      </div>
    </>
  );

  // 미리보기가 열려 있으면 튜토리얼 UI를 모두 숨김
  // (미리보기 자체의 닫기 버튼으로 복귀 → previewOpened=true라 다음 단계 진행 가능)
  if (previewOpen) return null;

  return (
    <>
      {/* 우측 상단 튜토리얼 종료 */}
      <button className="ct-exit" onClick={onFinish}>튜토리얼 종료 ✕</button>

      {/* 좌측 파일 보관함 */}
      <aside className="ct-filebox">
        <div className="ct-filebox-title">튜토리얼 파일</div>
        <div className="ct-filebox-list">
          {TUT_FILES.map(f => (
            <div
              key={f.id}
              className={`ct-file${isDragTarget(f.id) ? " ct-file--highlight" : ""}`}
              draggable
              onDragStart={e => e.dataTransfer.setData("fileId", f.id)}
            >
              <span className="ct-file-name">{fileName(f)}</span>
            </div>
          ))}
        </div>
        <p className="ct-filebox-note">현재 단계에 필요한 파일이 강조됩니다.</p>
      </aside>

      {/* 오버레이 */}
      {!rect ? (
        <div className="ct-overlay ct-overlay--center">
          <div className="ct-bubble ct-bubble--center">{bubbleInner}</div>
        </div>
      ) : (
        <div className="ct-overlay">
          {/* 블러 마스크 — rect 변경 시에만 리렌더 */}
          <BlurMask rect={rect} />

          {/* 드롭존 (드롭 스텝에서만) */}
          {dropKinds.length > 0 && (
            <div
              className={`ct-dropzone${dropActive ? " ct-dropzone--active" : ""}`}
              style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
              onDragOver={e => { e.preventDefault(); setDropActive(true); }}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDrop}
            >
              {!practiceComplete && <span className="ct-drop-hint">여기에 파일을 놓으세요</span>}
            </div>
          )}

          {/* 연결선 */}
          {connector && (
            <svg className="ct-connector">
              <line x1={connector.x1} y1={connector.y1} x2={connector.x2} y2={connector.y2}
                stroke="#ea580c" strokeWidth={2} strokeDasharray="4 4" />
              <circle cx={connector.x1} cy={connector.y1} r={3} fill="#ea580c" />
            </svg>
          )}
          <div className="ct-bubble" style={bubbleStyle}>{bubbleInner}</div>
        </div>
      )}
    </>
  );
};

export default ContestTutorial;
