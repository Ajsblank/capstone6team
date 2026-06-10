jest.mock('./authApi', () => ({
  getAccessToken: jest.fn().mockReturnValue('test-token'),
}));

jest.mock('./sseApi', () => ({
  setValidationResultCallback: jest.fn(),
}));

import {
  validateContestCode,
  subscribeToValidationResults,
  unsubscribeFromValidationResults,
  ValidateRequestPayload,
  ValidationResult,
} from './validationApi';
import { setValidationResultCallback } from './sseApi';
import { getAccessToken } from './authApi';

const mockSetCallback = setValidationResultCallback as jest.Mock;
const mockGetAccessToken = getAccessToken as jest.Mock;

const payload: ValidateRequestPayload = {
  judgeCode: 'judge code',
  sampleCodes: [{ code: 'sample', language: 'PYTHON' }],
  exampleAiCodes: [{ code: 'ai', language: 'PYTHON', description: '랜덤' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAccessToken.mockReturnValue('test-token');
  global.fetch = jest.fn();
});

// ─────────────────────────────────────────────────────────
describe('validateContestCode()', () => {
  it('성공(200) 시 에러 없이 완료된다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    await expect(validateContestCode(payload)).resolves.toBeUndefined();
  });

  it('Authorization 헤더에 Bearer 토큰을 포함한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    await validateContestCode(payload);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer test-token');
  });

  it('Content-Type이 application/json이다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    await validateContestCode(payload);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('body에 payload가 JSON으로 직렬화된다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    await validateContestCode(payload);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  it('HTTP 에러 시 JSON의 error 필드를 메시지로 throw한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":"잘못된 요청"}',
    });
    await expect(validateContestCode(payload)).rejects.toThrow('잘못된 요청');
  });

  it('HTTP 에러 시 JSON의 message 필드를 메시지로 throw한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"message":"서버 내부 오류"}',
    });
    await expect(validateContestCode(payload)).rejects.toThrow('서버 내부 오류');
  });

  it('평문 에러 본문이면 그대로 throw한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'validation failed',
    });
    await expect(validateContestCode(payload)).rejects.toThrow('validation failed');
  });

  it('빈 에러 본문이면 "검증 요청 실패: <status>" 메시지로 throw한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '',
    });
    await expect(validateContestCode(payload)).rejects.toThrow('검증 요청 실패: 503');
  });

  it('네트워크 오류 시 에러를 그대로 전파한다', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'));
    await expect(validateContestCode(payload)).rejects.toThrow('network error');
  });
});

// ─────────────────────────────────────────────────────────
describe('subscribeToValidationResults()', () => {
  it('setValidationResultCallback에 콜백 함수를 등록한다', () => {
    subscribeToValidationResults(jest.fn(), jest.fn());
    expect(mockSetCallback).toHaveBeenCalledWith(expect.any(Function));
  });

  it('등록된 래퍼 함수가 호출되면 onResult를 실행한다', () => {
    const onResult = jest.fn();
    subscribeToValidationResults(onResult, jest.fn());

    const wrapper: (result: ValidationResult) => void = mockSetCallback.mock.calls[0][0];
    const mockResult: ValidationResult = { passed: true, details: [] };
    wrapper(mockResult);

    expect(onResult).toHaveBeenCalledWith(mockResult);
  });

  it('각 호출마다 새로운 콜백을 등록한다', () => {
    subscribeToValidationResults(jest.fn(), jest.fn());
    subscribeToValidationResults(jest.fn(), jest.fn());
    expect(mockSetCallback).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────
describe('unsubscribeFromValidationResults()', () => {
  it('setValidationResultCallback에 null을 전달한다', () => {
    unsubscribeFromValidationResults();
    expect(mockSetCallback).toHaveBeenCalledWith(null);
  });

  it('여러 번 호출해도 에러가 발생하지 않는다', () => {
    expect(() => {
      unsubscribeFromValidationResults();
      unsubscribeFromValidationResults();
    }).not.toThrow();
  });
});
