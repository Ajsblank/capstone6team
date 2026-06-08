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
  (global as any).__mockBattleAxios = instance;
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      defaults: { headers: { common: {} } },
    },
    create: jest.fn(() => instance),
  };
});

// codeBattleApi.ts가 authApi에서 getAccessToken, applyAuthInterceptor를 import하므로 mock 필요
jest.mock('./authApi', () => ({
  getAccessToken: jest.fn().mockReturnValue('test-token'),
  applyAuthInterceptor: jest.fn(),
}));

import {
  getContestList,
  getContestDetail,
  joinContest,
  submitCode,
  getMyBattleSubmissions,
  getContestSessions,
  getFinalResult,
  getSessionLeaderboard,
  getSwissMatchLog,
} from './codeBattleApi';
import { SubmitRequest } from '../types';

const mockApi = (global as any).__mockBattleAxios as {
  post: jest.Mock;
  get: jest.Mock;
  patch: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('getContestList()', () => {
  it('대회 목록을 반환한다', async () => {
    const mockData = {
      content: [{ id: 1, title: '테스트 대회', status: 'OPEN' }],
      totalPages: 1,
      totalElements: 1,
      size: 10,
      number: 0,
    };
    mockApi.get.mockResolvedValue({ data: mockData });

    const result = await getContestList(0, 10);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].title).toBe('테스트 대회');
    expect(result.totalPages).toBe(1);
  });

  it('page와 size가 URL 파라미터에 포함된다', async () => {
    mockApi.get.mockResolvedValue({
      data: { content: [], totalPages: 0, totalElements: 0, size: 5, number: 2 },
    });

    await getContestList(2, 5);

    const url: string = mockApi.get.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('size=5');
  });

  it('sort 파라미터가 있으면 URL에 포함된다', async () => {
    mockApi.get.mockResolvedValue({
      data: { content: [], totalPages: 0, totalElements: 0, size: 10, number: 0 },
    });

    await getContestList(0, 10, ['startDate,desc']);

    const url: string = mockApi.get.mock.calls[0][0];
    expect(url).toContain('sort=startDate%2Cdesc');
  });

  it('API 실패 시 에러를 전파한다', async () => {
    mockApi.get.mockRejectedValue(new Error('서버 오류'));
    await expect(getContestList(0, 10)).rejects.toThrow('서버 오류');
  });
});

// ─────────────────────────────────────────────────────────
describe('getContestDetail()', () => {
  const mockDetail = {
    id: 42,
    title: '알고리즘 대전',
    description: '설명',
    certification: false,
    timeLimitSec: 2,
    memoryLimitMb: 256,
    sampleCodes: [],
    status: 'OPEN',
    visualizationHtml: '',
    soloPlayHtml: '',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    maxParticipants: 50,
    createdAt: '2026-01-01',
    exampleAiCodes: [],
    creator_id: 1,
  };

  it('대회 상세 정보를 반환한다', async () => {
    mockApi.get.mockResolvedValue({ data: mockDetail });

    const result = await getContestDetail(42);

    expect(result.id).toBe(42);
    expect(result.title).toBe('알고리즘 대전');
    expect(mockApi.get).toHaveBeenCalledWith('/api/contests/42');
  });
});

// ─────────────────────────────────────────────────────────
describe('joinContest()', () => {
  it('올바른 경로와 이메일 파라미터로 참가 요청을 전송한다', async () => {
    mockApi.post.mockResolvedValue({ data: {} });

    await joinContest(10, 'alice@test.com');

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/contests/10/join',
      null,
      expect.objectContaining({ params: { email: 'alice@test.com' } })
    );
  });
});

// ─────────────────────────────────────────────────────────
describe('submitCode()', () => {
  it('제출 데이터를 올바른 경로로 전송하고 응답을 반환한다', async () => {
    const payload: SubmitRequest = {
      userId: 'user_1',
      problemId: '5',
      language: 'python',
      sourceCode: 'print("hello")',
    };
    const mockResponse = { success: true, message: '제출 완료' };
    mockApi.post.mockResolvedValue({ data: mockResponse });

    const result = await submitCode(payload);

    expect(result).toEqual(mockResponse);
    expect(mockApi.post).toHaveBeenCalledWith('/api/code/submit/codebattle', payload);
  });
});

// ─────────────────────────────────────────────────────────
describe('getMyBattleSubmissions()', () => {
  it('특정 유저의 제출 내역을 반환한다', async () => {
    const mockSubmissions = [
      { submissionId: 1, createdAt: '2026-06-01', result: { aiId: 10, status: 'WIN', log: '' } },
      { submissionId: 2, createdAt: '2026-06-02', result: { aiId: 10, status: 'LOSE', log: '' } },
    ];
    mockApi.get.mockResolvedValue({ data: mockSubmissions });

    const result = await getMyBattleSubmissions(5, 'user_1');

    expect(result).toHaveLength(2);
    expect(result[0].result.status).toBe('WIN');
    expect(mockApi.get).toHaveBeenCalledWith('/api/contests/5/user_1');
  });
});

// ─────────────────────────────────────────────────────────
describe('getContestSessions()', () => {
  it('세션 목록을 반환한다', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { sessionNumber: 1, scheduledAt: '2026-06-01T09:00', status: 'END' },
        { sessionNumber: 2, scheduledAt: null, status: 'RUNNING' },
      ],
    });

    const result = await getContestSessions(3);

    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('END');
    expect(result[1].scheduledAt).toBeNull();
    expect(mockApi.get).toHaveBeenCalledWith('/api/contests/3/sessionList');
  });
});

// ─────────────────────────────────────────────────────────
describe('getFinalResult()', () => {
  it('최종 결과와 순위를 반환한다', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        total_participants: 4,
        'final-standings': [
          { user_id: 1, wins: 3, draws: 0, losses: 0, rank: 1, points: 9 },
          { user_id: 2, wins: 2, draws: 1, losses: 0, rank: 2, points: 7 },
        ],
      },
    });

    const result = await getFinalResult(5);

    expect(result.total_participants).toBe(4);
    expect(result['final-standings']).toHaveLength(2);
    expect(result['final-standings'][0].rank).toBe(1);
    expect(mockApi.get).toHaveBeenCalledWith('/api/contests/5/final-result');
  });
});

// ─────────────────────────────────────────────────────────
describe('getSessionLeaderboard()', () => {
  it('세션 리더보드를 반환한다', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        session_number: 1,
        total_participants: 8,
        total_rounds: 3,
        final_standings: [{ user_id: 1, wins: 3, draws: 0, losses: 0, points: 9, rank: 1 }],
      },
    });

    const result = await getSessionLeaderboard(7, 1);

    expect(result.session_number).toBe(1);
    expect(result.final_standings).toHaveLength(1);
    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/contests/7/sessionLeaderBoard',
      expect.objectContaining({ params: { sessionNumber: 1 } })
    );
  });
});

// ─────────────────────────────────────────────────────────
describe('getSwissMatchLog()', () => {
  it('매치 로그를 반환한다', async () => {
    mockApi.get.mockResolvedValue({ data: { log: 'round1: player1 wins' } });

    const result = await getSwissMatchLog(3, 101);

    expect(result.log).toBe('round1: player1 wins');
    expect(mockApi.get).toHaveBeenCalledWith('/api/contests/3/swiss/viewMatchLog/101');
  });
});
