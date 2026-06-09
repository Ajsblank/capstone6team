import axios from "axios";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { getAccessToken, applyAuthInterceptor } from "./authApi";
import { ContestStatus, AiCodeEntry } from "./contestApi";

const BASE_URL = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});
applyAuthInterceptor(api);

// ── 상수 ──────────────────────────────────────────────────────────────────────
export const TOSS_CLIENT_KEY = "test_ck_Z1aOwX7K8mewZODWGK298yQxzvNP";
export const PAYMENT_AMOUNT  = { uncertified: 10_000, certified: 100_000 } as const;
const DRAFT_KEY = "contest_payment_draft";

// ── 결제 확인 API ──────────────────────────────────────────────────────────────
export interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
  contestId: number;
}

export const confirmPayment = async (req: PaymentConfirmRequest): Promise<void> => {
  await api.post("/api/payment/confirm", req, { timeout: 20_000 });
};

// ── 파일 직렬화 ────────────────────────────────────────────────────────────────
export interface SerializedFile {
  name: string;
  type: string;
  data: string; // base64 data URL
}

export async function serializeFile(file: File): Promise<SerializedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result as string });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function deserializeFile(sf: SerializedFile): File {
  const [, base64] = sf.data.split(",");
  const bytes = atob(base64);
  const ab = new ArrayBuffer(bytes.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i);
  return new File([ab], sf.name, { type: sf.type });
}

// ── 임시저장 타입 ──────────────────────────────────────────────────────────────
export interface PaymentDraft {
  orderId: string;
  amount: number;
  certification: boolean;
  creatorId: number;
  title: string;
  description: string;
  timeLimitSec: number;
  memoryLimitMb: number;
  status: ContestStatus;
  startDate: string;
  endDate: string;
  maxParticipants: number;
  sampleCodes: SerializedFile[];
  judgeCode: SerializedFile;
  exampleAiCodes: { file: SerializedFile; description: string }[];
  visualizationHtml: SerializedFile | null;
  soloPlayHtml: SerializedFile | null;
  reviewerEmails?: string[];
}

export async function buildDraft(
  orderId: string,
  amount: number,
  fields: {
    certification: boolean;
    creatorId: number;
    title: string;
    description: string;
    timeLimitSec: number;
    memoryLimitMb: number;
    status: ContestStatus;
    startDate: string;
    endDate: string;
    maxParticipants: number;
    sampleCodes: File[];
    judgeCode: File;
    exampleAiCodes: AiCodeEntry[];
    visualizationHtml: File | null;
    soloPlayHtml: File | null;
    reviewerEmails?: string[];
  }
): Promise<PaymentDraft> {
  const [sampleCodes, judgeCode, exAiFiles, visHtml, soloHtml] = await Promise.all([
    Promise.all(fields.sampleCodes.map(serializeFile)),
    serializeFile(fields.judgeCode),
    Promise.all(fields.exampleAiCodes.map(e => serializeFile(e.file))),
    fields.visualizationHtml ? serializeFile(fields.visualizationHtml) : Promise.resolve(null),
    fields.soloPlayHtml      ? serializeFile(fields.soloPlayHtml)      : Promise.resolve(null),
  ]);
  return {
    orderId, amount,
    certification:    fields.certification,
    creatorId:        fields.creatorId,
    title:            fields.title,
    description:      fields.description,
    timeLimitSec:     fields.timeLimitSec,
    memoryLimitMb:    fields.memoryLimitMb,
    status:           fields.status,
    startDate:        fields.startDate,
    endDate:          fields.endDate,
    maxParticipants:  fields.maxParticipants,
    sampleCodes,
    judgeCode,
    exampleAiCodes: fields.exampleAiCodes.map((e, i) => ({
      file: exAiFiles[i], description: e.description,
    })),
    visualizationHtml: visHtml,
    soloPlayHtml:      soloHtml,
    reviewerEmails:    fields.reviewerEmails,
  };
}

export function saveDraft(draft: PaymentDraft): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft(): PaymentDraft | null {
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as PaymentDraft; } catch { return null; }
}

export function clearDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

// ── Toss 결제 요청 ─────────────────────────────────────────────────────────────
export async function requestTossPayment(
  orderId: string,
  amount: number,
  orderName: string
): Promise<void> {
  const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
  // v2 SDK: anonymous payment
  const payment = (tossPayments as any).payment({ customerKey: orderId });
  const successUrl = window.location.origin + window.location.pathname + "?paymentStatus=success";
  const failUrl    = window.location.origin + window.location.pathname + "?paymentStatus=fail";

  await payment.requestPayment({
    method:   "CARD",
    amount:   { currency: "KRW", value: amount },
    orderId,
    orderName,
    successUrl,
    failUrl,
  });
}
