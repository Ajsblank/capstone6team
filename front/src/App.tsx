import React, { useEffect, useState, useRef } from "react";
import { AppProvider, useApp } from "./context/AppContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import BattleHomePage from "./pages/BattleHomePage";
import BattleSubmitPage from "./pages/BattleSubmitPage";
import ProfilePage from "./pages/ProfilePage";
import BattleCreateContestPage from "./pages/BattleCreateContestPage";
import BattleCreateCertifiedPage from "./pages/BattleCreateCertifiedPage";
import ContestSettingsPage from "./pages/ContestSettingsPage";
import SwissTournamentPage from "./pages/SwissTournamentPage";
import {
  loadDraft, clearDraft, deserializeFile, confirmPayment, PaymentDraft,
} from "./api/paymentApi";
import { createContest, createCertifiedContest, AiCodeEntry } from "./api/contestApi";
import { getContestDetail } from "./api/codeBattleApi";

// ── 결제 리다이렉트 처리 ──────────────────────────────────────────────────────

function usePaymentRedirect() {
  const { navigate } = useApp();
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;  // StrictMode 이중 실행 가드
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const status     = params.get("paymentStatus");
    const paymentKey = params.get("paymentKey");
    const orderId    = params.get("orderId");
    const amount     = params.get("amount");

    // 리다이렉트 URL 전체 로그
    console.log("[Payment] 리다이렉트 감지 — 전체 search:", window.location.search);
    console.log("[Payment] 파싱 결과 — status:", status, "| paymentKey:", paymentKey, "| orderId:", orderId, "| amount:", amount);

    // URL 파라미터 즉시 제거
    if (status) {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }

    if (status === "success" && paymentKey && orderId && amount) {
      const draft = loadDraft();
      if (!draft) {
        setPaymentError("결제 임시 데이터를 찾을 수 없습니다. 다시 시도해주세요.");
        return;
      }
      setPaymentProcessing(true);
      handlePaymentSuccess(draft, paymentKey, orderId, Number(amount), navigate, setPaymentError)
        .finally(() => setPaymentProcessing(false));
    }

    if (status === "fail") {
      // draft 유지 — create-contest 페이지에서 복구
      sessionStorage.setItem("payment_fail_restore", "1");
      navigate("create-contest");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 에러 화면의 "확인" → 입력 시점(create-contest)으로 복귀, draft 복원
  const clearPaymentError = () => {
    setPaymentError(null);
    sessionStorage.setItem("payment_fail_restore", "1");
    navigate("create-contest");
  };

  return { paymentProcessing, paymentError, clearPaymentError };
}

async function handlePaymentSuccess(
  draft: PaymentDraft,
  paymentKey: string,
  orderId: string,
  amount: number,
  navigate: (page: any) => void,
  onError: (msg: string) => void
) {
  try {
    console.group("[Payment] 결제 성공 처리 시작");
    console.log("▶ Toss paymentKey:", paymentKey);
    console.log("▶ Toss orderId (URL):", orderId);
    console.log("▶ Toss amount (URL):", amount);
    console.log("▶ draft.orderId:", draft.orderId);
    console.log("▶ draft.amount:", draft.amount);
    console.log("▶ draft.certification:", draft.certification);
    console.log("▶ orderId 일치 여부:", orderId === draft.orderId);

    // 직렬화된 파일 복원
    console.log("[Payment] 파일 복원 중...");
    const sampleCodes      = draft.sampleCodes.map(deserializeFile);
    const judgeCode        = deserializeFile(draft.judgeCode);
    const exampleAiCodes: AiCodeEntry[] = draft.exampleAiCodes.map(e => ({
      file: deserializeFile(e.file),
      description: e.description,
    }));
    const visualizationHtml = draft.visualizationHtml ? deserializeFile(draft.visualizationHtml) : null;
    const soloPlayHtml      = draft.soloPlayHtml      ? deserializeFile(draft.soloPlayHtml)      : null;
    console.log("[Payment] 파일 복원 완료 — sampleCodes:", sampleCodes.length, "exampleAiCodes:", exampleAiCodes.length);

    const contestData = {
      title: draft.title, description: draft.description,
      certification: draft.certification,
      timeLimitSec: draft.timeLimitSec, memoryLimitMb: draft.memoryLimitMb,
      status: draft.status, startDate: draft.startDate, endDate: draft.endDate,
      maxParticipants: draft.maxParticipants, creatorId: draft.creatorId,
      sampleCodes, judgeCode, exampleAiCodes, visualizationHtml, soloPlayHtml,
    };

    // 대회 생성
    console.log("[Payment] 대회 생성 API 호출...");
    let result;
    if (draft.certification) {
      result = await createCertifiedContest(contestData, draft.reviewerEmails ?? []);
    } else {
      result = await createContest(contestData);
    }
    console.log("[Payment] 대회 생성 완료 — contestId:", result.id);

    // 서버에 저장된 대회의 실제 certification 확인 (금액 불일치 디버깅)
    try {
      const detail = await getContestDetail(result.id);
      console.log("[Payment] 서버 저장 대회 — certification:", detail.certification, "| 기대 금액:", detail.certification ? 100000 : 10000);
    } catch (e) {
      console.warn("[Payment] 대회 상세 조회 실패:", e);
    }

    // 결제 확인
    console.log("[Payment] confirmPayment 호출 — amount:", amount, "| contestId:", result.id);
    await confirmPayment({ paymentKey, orderId, amount, contestId: result.id });
    console.log("[Payment] 결제 확인 완료");

    console.groupEnd();
    clearDraft();
    navigate("battle");
  } catch (err: any) {
    console.error("[Payment] 오류 발생:", err);
    console.error("[Payment] 응답:", err?.response?.data);
    console.groupEnd();
    const serverMsg = err?.response?.data?.message ?? err?.response?.data?.error;
    const status    = err?.response?.status;
    onError(
      serverMsg
        ? `[${status}] ${serverMsg}`
        : err?.message
        ?? "대회 생성 또는 결제 확인 중 오류가 발생했습니다."
    );
  }
}

// ── 페이지 라우터 ────────────────────────────────────────────────────────────

const PageRouter: React.FC = () => {
  const { currentPage } = useApp();
  const { paymentProcessing, paymentError, clearPaymentError } = usePaymentRedirect();

  if (paymentProcessing) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#0f1117",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
        color: "#e2e8f0", fontFamily: "'IBM Plex Sans KR', sans-serif",
      }}>
        <div style={{
          width: 48, height: 48,
          border: "4px solid #1e2535", borderTopColor: "#00f5c4",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          결제를 처리하는 중입니다...
        </p>
        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
          잠시만 기다려주세요.
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (paymentError) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#0f1117",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
        color: "#e2e8f0", fontFamily: "'IBM Plex Sans KR', sans-serif",
      }}>
        <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f87171", margin: 0 }}>
          결제 오류
        </p>
        <p style={{ fontSize: "0.9rem", color: "#94a3b8", margin: 0, textAlign: "center", maxWidth: 360 }}>
          {paymentError}
        </p>
        <button
          onClick={clearPaymentError}
          style={{
            background: "#ea580c", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 24px",
            fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
          }}
        >
          확인
        </button>
      </div>
    );
  }

  switch (currentPage) {
    case "landing":          return <LandingPage />;
    case "login":            return <LoginPage />;
    case "signup":           return <SignUpPage />;
    case "battle":           return <BattleHomePage />;
    case "submit":           return <BattleSubmitPage />;
    case "profile":          return <ProfilePage />;
    case "create-contest":            return <BattleCreateContestPage />;
    case "create-certified-contest":  return <BattleCreateCertifiedPage />;
    case "contest-settings":          return <ContestSettingsPage />;
    case "tournament":                return <SwissTournamentPage />;
    case "tutorial-contest":          return <BattleCreateContestPage tutorial />;
    default:                 return <LandingPage />;
  }
};

function App() {
  return (
    <AppProvider>
      <PageRouter />
    </AppProvider>
  );
}

export default App;
