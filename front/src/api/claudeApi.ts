import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.REACT_APP_CLAUDE_API_KEY ?? "";
const MODEL   = "claude-opus-4-8";

function getClient() {
  if (!API_KEY) throw new Error("REACT_APP_CLAUDE_API_KEY가 설정되지 않았습니다.");
  return new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function stream(
  system: string,
  prompt: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const client = getClient();
  const s = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  let full = "";
  for await (const event of s) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      full += event.delta.text;
      onChunk(event.delta.text);
    }
  }
  return full;
}

const BASE_PROTOCOL = `
READY   | READY (FIRST|SECOND)      | 선/후공 정보 수신. 3초 이내 OK 출력
INIT    | INIT <game-specific-data> | 게임 보드 초기화. 출력 불필요
TIME    | TIME t1 t2                | 내 남은시간 t1, 상대 남은시간 t2 수신. 이번 턴 행동을 출력
OPP     | OPP <action> t            | 상대 행동과 사용시간 수신. 출력 불필요
FINISH  | FINISH                    | 게임 종료. 프로그램 정상 종료
`.trim();

export async function generateIOFormat(
  description: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const system = `당신은 코딩 대결 플랫폼의 게임 프로토콜 설계자입니다.`;
  const prompt = [
    `게임 설명:`,
    `---`,
    description,
    `---`,
    ``,
    `모든 게임은 아래 기본 프로토콜을 따릅니다. 이를 이 게임에 맞게 구체화하세요:`,
    BASE_PROTOCOL,
    ``,
    `요구사항:`,
    `- INIT 명령의 데이터 형식을 이 게임의 보드/상태에 맞게 구체적으로 정의하세요.`,
    `- TIME 명령에서 출력해야 할 행동 형식을 구체적으로 정의하세요.`,
    `- OPP 명령에서 전달되는 상대 행동 형식을 정의하세요.`,
    `- 필요하다면 게임 특화 명령을 추가하세요.`,
    `- 마크다운 표 형식으로 출력하세요.`,
    `- 각 명령 아래에 입출력 예시를 포함하세요.`,
  ].join("\n");
  return stream(system, prompt, onChunk);
}

export async function generateJudgeCode(
  description: string,
  ioFormat: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const system = `당신은 코딩 대결 플랫폼의 채점 코드 개발자입니다.`;
  const prompt = [
    `게임 설명:`,
    `---`,
    description,
    `---`,
    ``,
    `확정된 입출력 프로토콜:`,
    `---`,
    ioFormat,
    `---`,
    ``,
    `위 프로토콜을 구현하는 Python 채점 코드를 작성하세요.`,
    `채점 코드의 역할:`,
    `- 두 플레이어 프로세스(subprocess)를 실행하고 stdin/stdout으로 통신`,
    `- READY → INIT → (TIME → OPP) 반복 → FINISH 순서로 명령 전송`,
    `- 게임 규칙에 따라 상태를 관리하고 승패를 판정`,
    `- 각 플레이어의 응답 유효성 검사 및 시간 초과 처리`,
    ``,
    `Python 코드만 출력하세요. 완전히 동작하는 코드여야 합니다.`,
  ].join("\n");
  return stream(system, prompt, onChunk);
}

export async function generateSkeletonCode(
  ioFormat: string,
  judgeCode: string,
  language: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const system = `당신은 코딩 대결 플랫폼의 스켈레톤 코드 작성자입니다.`;
  const prompt = [
    `입출력 프로토콜:`,
    `---`,
    ioFormat,
    `---`,
    ``,
    `채점 코드 (참고용):`,
    `---`,
    judgeCode.slice(0, 3000),
    `---`,
    ``,
    `위 프로토콜을 따르는 ${language} 스켈레톤 코드를 작성하세요.`,
    `스켈레톤 코드 요구사항:`,
    `- 모든 명령(READY, INIT, TIME, OPP, FINISH)을 처리하는 메인 루프 구현`,
    `- 게임 상태를 저장하는 자료구조 정의`,
    `- TIME 명령 처리 부분에 TODO 주석으로 전략 구현 위치 표시`,
    `- 기본 동작(랜덤 또는 첫 번째 유효한 수 선택)은 구현`,
    `- sys.stdout.flush() 또는 동등한 즉시 출력 처리 포함`,
    ``,
    `${language} 코드만 출력하세요.`,
  ].join("\n");
  return stream(system, prompt, onChunk);
}

export async function generateExampleAICode(
  skeletonCode: string,
  strategy: string,
  language: string,
  onChunk: (t: string) => void,
): Promise<string> {
  const system = `당신은 코딩 대결 플랫폼의 AI 플레이어 개발자입니다.`;
  const prompt = [
    `스켈레톤 코드:`,
    `---`,
    skeletonCode,
    `---`,
    ``,
    `구현할 전략:`,
    `---`,
    strategy || "탐욕 알고리즘(greedy) 기반의 기본 전략을 구현하세요.",
    `---`,
    ``,
    `스켈레톤 코드의 TODO 부분을 위 전략으로 채워 완성된 AI 플레이어 코드를 작성하세요.`,
    `- 스켈레톤 구조를 유지하면서 전략 로직만 구현`,
    `- 시간 초과가 발생하지 않도록 효율적으로 구현`,
    `- 완전히 동작하는 ${language} 코드만 출력하세요.`,
  ].join("\n");
  return stream(system, prompt, onChunk);
}

export async function generateVisualHtml(
  description: string,
  sampleCodeContent: string,
  mode: "visualization" | "solo",
  onChunk: (t: string) => void,
): Promise<string> {
  const modeDesc =
    mode === "visualization"
      ? "대결 현황을 실시간으로 보여주는 시각화 HTML 페이지 (관전자용, 두 플레이어의 상태를 나란히 표시)"
      : "혼자서 게임을 플레이해볼 수 있는 HTML 페이지 (싱글플레이어용, 키보드/마우스 입력 처리 포함)";

  const codeSection = sampleCodeContent
    ? `\n참고 샘플 코드:\n\`\`\`\n${sampleCodeContent.slice(0, 3000)}\n\`\`\``
    : "";

  const system = `당신은 코딩 대결 플랫폼의 웹 개발자입니다. 완전한 단일 HTML 파일을 작성합니다.`;
  const prompt = [
    `다음은 코딩 대결 게임의 문제 설명입니다:`,
    `---`,
    description,
    `---`,
    codeSection,
    `위 게임을 위한 ${modeDesc}를 단일 HTML 파일로 작성해주세요.`,
    `요구사항:`,
    `- 순수 HTML/CSS/JavaScript만 사용 (외부 CDN 허용)`,
    `- 완전한 단일 파일 (<!DOCTYPE html>부터 </html>까지)`,
    `- 반응형 디자인, 어두운 배경 테마`,
    `- HTML 코드만 출력하세요. 설명 없이 코드만 작성하세요.`,
  ].join("\n");

  return stream(system, prompt, onChunk);
}
