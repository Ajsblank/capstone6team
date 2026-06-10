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
  (global as any).__mockContestAxios = instance;
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

import { extToLanguage, patchContest, createContest, modifyContest } from './contestApi';

const mockApi = (global as any).__mockContestAxios as {
  post: jest.Mock;
  patch: jest.Mock;
};

const makeFile = (content: string, name: string) =>
  new File([content], name, { type: 'text/plain' });

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

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('extToLanguage()', () => {
  it.each([
    ['main.cpp',  'CPP'],
    ['main.cc',   'CPP'],
    ['main.cxx',  'CPP'],
    ['main.c',    'CPP'],
    ['Main.java', 'JAVA'],
    ['sol.py',    'PYTHON'],
    ['app.js',    'JAVASCRIPT'],
    ['app.ts',    'TYPESCRIPT'],
    ['Game.cs',   'CSHARP'],
    ['main.go',   'GO'],
    ['lib.rs',    'RUST'],
    ['Main.kt',   'KOTLIN'],
    ['script.lua','LUA'],
  ])('%s → %s', (filename, expected) => {
    expect(extToLanguage(filename)).toBe(expected);
  });

  it('알 수 없는 확장자는 대문자로 반환한다', () => {
    expect(extToLanguage('file.rb')).toBe('RB');
  });

  it('점(.)이 없는 파일명은 파일명 전체를 대문자로 반환한다', () => {
    expect(extToLanguage('Makefile')).toBe('MAKEFILE');
  });

  it('확장자 대소문자를 구분하지 않는다', () => {
    expect(extToLanguage('Main.CPP')).toBe('CPP');
    expect(extToLanguage('Main.Java')).toBe('JAVA');
    expect(extToLanguage('sol.PY')).toBe('PYTHON');
  });
});

// ─────────────────────────────────────────────────────────
describe('patchContest()', () => {
  it('isCertified 기본값(false)이면 uncertified URL로 PATCH 요청한다', async () => {
    mockApi.patch.mockResolvedValue({});
    await patchContest(1, { title: '수정 제목' });
    expect(mockApi.patch).toHaveBeenCalledWith(
      '/api/contests/1/modify/uncertified',
      { title: '수정 제목' }
    );
  });

  it('isCertified=true이면 certified URL로 PATCH 요청한다', async () => {
    mockApi.patch.mockResolvedValue({});
    await patchContest(2, { status: 'RUNNING' }, true);
    expect(mockApi.patch).toHaveBeenCalledWith(
      '/api/contests/2/modify/certified',
      { status: 'RUNNING' }
    );
  });

  it('API 실패 시 에러를 전파한다', async () => {
    mockApi.patch.mockRejectedValue(new Error('권한 없음'));
    await expect(patchContest(1, {})).rejects.toThrow('권한 없음');
  });
});

// ─────────────────────────────────────────────────────────
describe('modifyContest() - 날짜 포맷 및 필드 처리', () => {
  const baseData = {
    title: '테스트 대회',
    description: '설명',
    timeLimitSec: 2,
    memoryLimitMb: 256,
    startDate: '2026-01-15T09:30:00',
    endDate: '2026-12-31T23:59:00',
    maxParticipants: 50,
  };

  it('startDate/endDate의 T를 공백으로 바꾸고 분 단위까지만 포함한다', async () => {
    mockApi.patch.mockResolvedValue({});
    await modifyContest(1, baseData);
    const body = mockApi.patch.mock.calls[0][1];
    expect(body.startDate).toBe('2026-01-15 09:30');
    expect(body.endDate).toBe('2026-12-31 23:59');
  });

  it('파일이 없으면 해당 필드를 body에 포함하지 않는다', async () => {
    mockApi.patch.mockResolvedValue({});
    await modifyContest(1, baseData);
    const body = mockApi.patch.mock.calls[0][1];
    expect(body).not.toHaveProperty('sampleCode');
    expect(body).not.toHaveProperty('judgeCode');
    expect(body).not.toHaveProperty('visualizationHtml');
    expect(body).not.toHaveProperty('soloPlayHtml');
  });

  it('sampleCode 파일이 있으면 텍스트로 읽어 body에 포함한다', async () => {
    mockApi.patch.mockResolvedValue({});
    await modifyContest(1, { ...baseData, sampleCode: makeFile('def main(): pass', 'sample.py') });
    const body = mockApi.patch.mock.calls[0][1];
    expect(body.sampleCode).toBe('def main(): pass');
  });

  it('reviewerEmails가 전달되면 body에 포함한다', async () => {
    mockApi.patch.mockResolvedValue({});
    await modifyContest(1, { ...baseData, reviewerEmails: ['a@test.com', 'b@test.com'] });
    const body = mockApi.patch.mock.calls[0][1];
    expect(body.reviewerEmails).toEqual(['a@test.com', 'b@test.com']);
  });

  it('reviewerEmails가 없으면 body에 포함하지 않는다', async () => {
    mockApi.patch.mockResolvedValue({});
    await modifyContest(1, baseData);
    const body = mockApi.patch.mock.calls[0][1];
    expect(body).not.toHaveProperty('reviewerEmails');
  });
});

// ─────────────────────────────────────────────────────────
describe('createContest()', () => {
  const baseContest = {
    title: '대회',
    description: '설명',
    certification: false,
    timeLimitSec: 2,
    memoryLimitMb: 256,
    status: 'TEST' as const,
    startDate: '2026-01-01T00:00',
    endDate: '2026-12-31T23:59',
    maxParticipants: 10,
    creatorId: 1,
    exampleAiCodes: [] as { file: File; description: string }[],
    visualizationHtml: null as File | null,
    soloPlayHtml: null as File | null,
  };

  it('파일 내용을 텍스트로 읽어 POST 요청을 보낸다', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 10, status: 'TEST', createdAt: '2026-01-01' } });

    const result = await createContest({
      ...baseContest,
      sampleCodes: [makeFile('sample code', 'sample.py')],
      judgeCode: makeFile('judge code', 'judge.cpp'),
    });

    expect(result.id).toBe(10);
    const body = mockApi.post.mock.calls[0][1];
    expect(body.sampleCodes[0]).toEqual({ code: 'sample code', language: 'PYTHON' });
    expect(body.judgeCode).toBe('judge code');
    expect(body.judgeLanguage).toBe('CPP');
  });

  it('visualizationHtml/soloPlayHtml이 null이면 body에 포함되지 않는다', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 1, status: 'TEST', createdAt: '2026-01-01' } });
    await createContest({
      ...baseContest,
      sampleCodes: [makeFile('code', 'sample.py')],
      judgeCode: makeFile('judge', 'judge.cpp'),
    });
    const body = mockApi.post.mock.calls[0][1];
    expect(body.visualizationHtml).toBeUndefined();
    expect(body.soloPlayHtml).toBeUndefined();
  });

  it('visualizationHtml 파일이 있으면 텍스트로 읽어 포함한다', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 1, status: 'TEST', createdAt: '2026-01-01' } });
    await createContest({
      ...baseContest,
      sampleCodes: [makeFile('code', 'sample.py')],
      judgeCode: makeFile('judge', 'judge.cpp'),
      visualizationHtml: makeFile('<html>viz</html>', 'viz.html'),
    });
    const body = mockApi.post.mock.calls[0][1];
    expect(body.visualizationHtml).toBe('<html>viz</html>');
  });

  it('exampleAiCodes의 파일 내용, 설명, 언어를 포함한다', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 1, status: 'TEST', createdAt: '2026-01-01' } });
    await createContest({
      ...baseContest,
      sampleCodes: [makeFile('code', 'sample.py')],
      judgeCode: makeFile('judge', 'judge.cpp'),
      exampleAiCodes: [{ file: makeFile('ai code', 'ai.py'), description: '랜덤 전략' }],
    });
    const body = mockApi.post.mock.calls[0][1];
    expect(body.exampleAiCodes[0]).toEqual({ code: 'ai code', description: '랜덤 전략', language: 'PYTHON' });
  });

  it('여러 sampleCodes의 언어를 각각 변환한다', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 1, status: 'TEST', createdAt: '2026-01-01' } });
    await createContest({
      ...baseContest,
      sampleCodes: [makeFile('py code', 'sample.py'), makeFile('cpp code', 'sample.cpp')],
      judgeCode: makeFile('judge', 'judge.cpp'),
    });
    const body = mockApi.post.mock.calls[0][1];
    expect(body.sampleCodes[0].language).toBe('PYTHON');
    expect(body.sampleCodes[1].language).toBe('CPP');
  });

  it('POST 경로가 /api/contests/create/uncertified이다', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 1, status: 'TEST', createdAt: '2026-01-01' } });
    await createContest({
      ...baseContest,
      sampleCodes: [makeFile('code', 'sample.py')],
      judgeCode: makeFile('judge', 'judge.cpp'),
    });
    expect(mockApi.post.mock.calls[0][0]).toBe('/api/contests/create/uncertified');
  });
});
