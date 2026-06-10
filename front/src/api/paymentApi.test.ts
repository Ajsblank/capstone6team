jest.mock('@tosspayments/tosspayments-sdk', () => ({
  loadTossPayments: jest.fn(),
}));

jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  (global as any).__mockPaymentAxios = instance;
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      defaults: { headers: { common: {} } },
    },
    create: jest.fn(() => instance),
  };
});

jest.mock('./authApi', () => ({
  getAccessToken: jest.fn().mockReturnValue('test-token'),
  applyAuthInterceptor: jest.fn(),
}));

import {
  serializeFile,
  deserializeFile,
  saveDraft,
  loadDraft,
  clearDraft,
  confirmPayment,
  SerializedFile,
  PaymentDraft,
} from './paymentApi';

const mockApi = (global as any).__mockPaymentAxios as { post: jest.Mock };

beforeAll(() => {
  if (!Blob.prototype.text) {
    Blob.prototype.text = function (): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(this as Blob);
      });
    };
  }
});

const minimalDraft: PaymentDraft = {
  orderId: 'order_001',
  amount: 10000,
  certification: false,
  creatorId: 1,
  title: '테스트 대회',
  description: '설명',
  timeLimitSec: 2,
  memoryLimitMb: 256,
  status: 'TEST',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  maxParticipants: 10,
  sampleCodes: [],
  judgeCode: { name: 'judge.cpp', type: 'text/plain', data: `data:text/plain;base64,${btoa('judge')}` },
  exampleAiCodes: [],
  visualizationHtml: null,
  soloPlayHtml: null,
};

beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('deserializeFile()', () => {
  it('base64 데이터 URL을 File 객체로 복원한다', async () => {
    const content = 'hello world';
    const sf: SerializedFile = {
      name: 'test.txt',
      type: 'text/plain',
      data: `data:text/plain;base64,${btoa(content)}`,
    };

    const file = deserializeFile(sf);

    expect(file.name).toBe('test.txt');
    expect(file.type).toBe('text/plain');
    expect(await file.text()).toBe('hello world');
  });

  it('파일명과 타입을 그대로 유지한다', () => {
    const sf: SerializedFile = {
      name: 'judge.cpp',
      type: 'text/x-c++src',
      data: `data:text/x-c++src;base64,${btoa('int main(){}')}`,
    };
    const file = deserializeFile(sf);
    expect(file.name).toBe('judge.cpp');
    expect(file.type).toBe('text/x-c++src');
  });

  it('빈 내용도 복원한다', async () => {
    const sf: SerializedFile = {
      name: 'empty.txt',
      type: 'text/plain',
      data: `data:text/plain;base64,${btoa('')}`,
    };
    const file = deserializeFile(sf);
    expect(await file.text()).toBe('');
  });
});

// ─────────────────────────────────────────────────────────
describe('serializeFile()', () => {
  it('File을 직렬화하면 name, type, base64 data가 포함된다', async () => {
    const file = new File(['sample content'], 'sample.py', { type: 'text/plain' });
    const sf = await serializeFile(file);

    expect(sf.name).toBe('sample.py');
    expect(sf.type).toBe('text/plain');
    expect(sf.data).toMatch(/^data:text\/plain;base64,/);
  });

  it('직렬화 후 역직렬화하면 원본 내용을 복원한다', async () => {
    const original = 'def main(): pass';
    const file = new File([original], 'main.py', { type: 'text/plain' });

    const sf = await serializeFile(file);
    const restored = deserializeFile(sf);

    expect(await restored.text()).toBe(original);
    expect(restored.name).toBe('main.py');
  });
});

// ─────────────────────────────────────────────────────────
describe('saveDraft() / loadDraft() / clearDraft()', () => {
  it('저장 전에는 null을 반환한다', () => {
    expect(loadDraft()).toBeNull();
  });

  it('저장 후 로드하면 동일한 draft를 반환한다', () => {
    saveDraft(minimalDraft);
    expect(loadDraft()).toEqual(minimalDraft);
  });

  it('clearDraft() 후에는 null을 반환한다', () => {
    saveDraft(minimalDraft);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it('덮어쓰기 시 마지막 값을 반환한다', () => {
    saveDraft(minimalDraft);
    saveDraft({ ...minimalDraft, title: '두 번째 대회' });
    expect(loadDraft()?.title).toBe('두 번째 대회');
  });

  it('sessionStorage 값이 깨진 JSON이면 null을 반환한다', () => {
    sessionStorage.setItem('contest_payment_draft', 'not-json');
    expect(loadDraft()).toBeNull();
  });

  it('draft는 sessionStorage에 저장된다', () => {
    saveDraft(minimalDraft);
    expect(sessionStorage.getItem('contest_payment_draft')).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
describe('confirmPayment()', () => {
  it('올바른 경로와 본문으로 POST 요청을 보낸다', async () => {
    mockApi.post.mockResolvedValue({});
    await confirmPayment({ paymentKey: 'pk_1', orderId: 'ord_1', amount: 10000, contestId: 5 });
    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/payment/confirm',
      { paymentKey: 'pk_1', orderId: 'ord_1', amount: 10000, contestId: 5 },
      expect.objectContaining({ timeout: 20_000 })
    );
  });

  it('API 실패 시 에러를 전파한다', async () => {
    mockApi.post.mockRejectedValue(new Error('결제 실패'));
    await expect(
      confirmPayment({ paymentKey: 'pk', orderId: 'ord', amount: 0, contestId: 1 })
    ).rejects.toThrow('결제 실패');
  });
});
