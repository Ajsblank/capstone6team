// jest.mock은 호이스팅되므로 factory 내부에 mock 인스턴스를 생성하고
// global에 저장해 테스트 코드에서 접근한다
jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  (global as any).__mockAuthAxios = instance;
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      defaults: { headers: { common: {} } },
    },
    create: jest.fn(() => instance),
  };
});

import {
  loginApi,
  signUp,
  logoutApi,
  refreshTokenApi,
  clearTokens,
  setAccessToken,
  getAccessToken,
  setUserId,
  getUserId,
  setUsername,
  getUsername,
  saveRefreshToken,
  getRefreshToken,
  setSessionId,
  getSessionId,
} from './authApi';

const mockApi = (global as any).__mockAuthAxios as {
  post: jest.Mock;
  get: jest.Mock;
  patch: jest.Mock;
};

beforeEach(() => {
  localStorage.clear();
  clearTokens();
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
// 토큰 관리 함수 (axios 불필요 — localStorage + 모듈 변수 조작)
// ─────────────────────────────────────────────────────────
describe('setAccessToken / getAccessToken', () => {
  it('토큰을 저장하고 조회한다', () => {
    setAccessToken('tok_abc');
    expect(getAccessToken()).toBe('tok_abc');
    expect(localStorage.getItem('accessToken')).toBe('tok_abc');
  });

  it('null을 넘기면 토큰을 제거한다', () => {
    setAccessToken('tok_abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
  });
});

describe('setUserId / getUserId', () => {
  it('userId를 저장하고 조회한다', () => {
    setUserId('user_42');
    expect(getUserId()).toBe('user_42');
    expect(localStorage.getItem('userId')).toBe('user_42');
  });

  it('null을 넘기면 userId를 제거한다', () => {
    setUserId('user_42');
    setUserId(null);
    expect(getUserId()).toBeNull();
    expect(localStorage.getItem('userId')).toBeNull();
  });
});

describe('setUsername / getUsername', () => {
  it('username을 저장하고 조회한다', () => {
    setUsername('alice');
    expect(getUsername()).toBe('alice');
    expect(localStorage.getItem('username')).toBe('alice');
  });
});

describe('saveRefreshToken / getRefreshToken', () => {
  it('refreshToken을 localStorage에 저장하고 조회한다', () => {
    saveRefreshToken('refresh_xyz');
    expect(getRefreshToken()).toBe('refresh_xyz');
    expect(localStorage.getItem('refreshToken')).toBe('refresh_xyz');
  });
});

describe('setSessionId / getSessionId', () => {
  it('sessionId를 저장하고 조회한다', () => {
    setSessionId('sess_abc');
    expect(getSessionId()).toBe('sess_abc');
    expect(localStorage.getItem('sessionId')).toBe('sess_abc');
  });

  it('null을 넘기면 sessionId를 제거한다', () => {
    setSessionId('sess_abc');
    setSessionId(null);
    expect(getSessionId()).toBeNull();
    expect(localStorage.getItem('sessionId')).toBeNull();
  });
});

describe('clearTokens()', () => {
  it('모든 인증 정보를 제거한다', () => {
    setAccessToken('tok');
    setUserId('uid');
    setUsername('name');
    saveRefreshToken('refresh');
    setSessionId('sess');

    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getUserId()).toBeNull();
    expect(getUsername()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getSessionId()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('sessionId')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
// API 함수
// ─────────────────────────────────────────────────────────
describe('loginApi()', () => {
  it('성공 시 토큰을 저장하고 응답 데이터를 반환한다', async () => {
    mockApi.post.mockResolvedValue({
      data: {
        accessToken: 'access_tok',
        refreshToken: 'refresh_tok',
        userId: 'user_1',
        sessionId: 'sess_xyz',
      },
    });

    const result = await loginApi({ email: 'alice@test.com', password: 'pass' });

    expect(result.accessToken).toBe('access_tok');
    expect(getAccessToken()).toBe('access_tok');
    expect(getRefreshToken()).toBe('refresh_tok');
    expect(getSessionId()).toBe('sess_xyz');
    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'alice@test.com',
      password: 'pass',
    });
  });

  it('sessionId가 없어도 정상 처리한다', async () => {
    mockApi.post.mockResolvedValue({
      data: { accessToken: 'tok', refreshToken: 'rtok', userId: 'uid' },
    });

    const result = await loginApi({ email: 'alice@test.com', password: 'pass' });

    expect(result.accessToken).toBe('tok');
    expect(getSessionId()).toBeNull();
  });

  it('실패 시 에러를 그대로 전파한다', async () => {
    mockApi.post.mockRejectedValue(new Error('Unauthorized'));
    await expect(loginApi({ email: 'x@x.com', password: 'wrong' })).rejects.toThrow('Unauthorized');
  });
});

describe('signUp()', () => {
  it('올바른 경로로 회원가입 요청을 전송한다', async () => {
    mockApi.post.mockResolvedValue({ data: {} });

    await signUp({ email: 'bob@test.com', password: 'pass123', nickname: 'bob' });

    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/signup', {
      email: 'bob@test.com',
      password: 'pass123',
      nickname: 'bob',
    });
  });

  it('API 실패 시 에러를 전파한다', async () => {
    mockApi.post.mockRejectedValue(new Error('이미 사용 중인 이메일'));
    await expect(signUp({ email: 'dup@test.com', password: 'pass', nickname: 'dup' })).rejects.toThrow();
  });
});

describe('logoutApi()', () => {
  it('sessionId가 있으면 로그아웃 API를 호출하고 토큰을 제거한다', async () => {
    setSessionId('sess_xyz');
    setAccessToken('access_tok');
    mockApi.post.mockResolvedValue({});

    await logoutApi();

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/auth/logout',
      null,
      expect.objectContaining({ headers: { 'X-Session-Id': 'sess_xyz' } })
    );
    expect(getAccessToken()).toBeNull();
    expect(getSessionId()).toBeNull();
  });

  it('sessionId가 없으면 API 호출 없이 토큰만 제거한다', async () => {
    setAccessToken('access_tok');

    await logoutApi();

    expect(mockApi.post).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
  });

  it('API 오류가 발생해도 토큰은 제거된다', async () => {
    setSessionId('sess_xyz');
    setAccessToken('access_tok');
    mockApi.post.mockRejectedValue(new Error('서버 오류'));

    await logoutApi(); // .catch(() => {}) 처리로 예외 미전파

    expect(getAccessToken()).toBeNull();
  });
});

describe('refreshTokenApi()', () => {
  it('성공 시 새 accessToken을 저장하고 반환한다', async () => {
    saveRefreshToken('old_refresh');
    mockApi.post.mockResolvedValue({
      data: {
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
        userId: 'user_1',
      },
    });

    const result = await refreshTokenApi();

    expect(result).toBe('new_access');
    expect(getAccessToken()).toBe('new_access');
    expect(getRefreshToken()).toBe('new_refresh');
    expect(mockApi.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refreshToken: 'old_refresh',
    });
  });

  it('응답에 sessionId가 있으면 sessionId를 업데이트한다', async () => {
    mockApi.post.mockResolvedValue({
      data: {
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
        sessionId: 'rotated_session',
      },
    });

    await refreshTokenApi();

    expect(getSessionId()).toBe('rotated_session');
  });

  it('응답에 sessionId가 없으면 기존 sessionId를 유지한다', async () => {
    setSessionId('existing_session');
    mockApi.post.mockResolvedValue({
      data: {
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
        // sessionId 없음
      },
    });

    await refreshTokenApi();

    expect(getSessionId()).toBe('existing_session');
  });

  it('실패 시 에러를 그대로 전파한다', async () => {
    mockApi.post.mockRejectedValue(new Error('Refresh token expired'));

    await expect(refreshTokenApi()).rejects.toThrow('Refresh token expired');
  });

  it('실패 시 기존 토큰은 그대로 유지된다', async () => {
    setAccessToken('old_access');
    mockApi.post.mockRejectedValue(new Error('Refresh failed'));

    await expect(refreshTokenApi()).rejects.toThrow();

    // refreshTokenApi 자체는 토큰을 삭제하지 않음
    // (clearTokens는 applyAuthInterceptor의 catch에서 호출)
    expect(getAccessToken()).toBe('old_access');
  });
});
