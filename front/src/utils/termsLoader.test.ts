import { parseTermsIntoSections, loadTerms } from './termsLoader';

// ─────────────────────────────────────────────────────────
describe('parseTermsIntoSections()', () => {
  it('## 기준으로 섹션을 분리한다', () => {
    const md = `## 제1조\n내용1\n\n## 제2조\n내용2`;
    const sections = parseTermsIntoSections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('제1조');
    expect(sections[0].content).toBe('내용1');
    expect(sections[1].title).toBe('제2조');
    expect(sections[1].content).toBe('내용2');
  });

  it('# H1 제목은 무시한다', () => {
    const md = `# 전체 제목\n\n## 제1조\n내용`;
    const sections = parseTermsIntoSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('제1조');
  });

  it('내용이 빈 섹션은 필터링한다', () => {
    const md = `## 빈 섹션\n\n## 내용 있는 섹션\n내용`;
    const sections = parseTermsIntoSections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('내용 있는 섹션');
  });

  it('빈 문자열 입력 시 빈 배열을 반환한다', () => {
    expect(parseTermsIntoSections('')).toEqual([]);
  });

  it('## 섹션이 없는 경우 빈 배열을 반환한다', () => {
    const md = `# 제목만\n내용은 있지만 섹션 없음`;
    expect(parseTermsIntoSections(md)).toEqual([]);
  });

  it('섹션 내 여러 줄 내용을 합친다', () => {
    const md = `## 섹션\n첫 번째 줄\n두 번째 줄\n세 번째 줄`;
    const sections = parseTermsIntoSections(md);
    expect(sections[0].content).toContain('첫 번째 줄');
    expect(sections[0].content).toContain('두 번째 줄');
    expect(sections[0].content).toContain('세 번째 줄');
  });

  it('제목 앞뒤 공백을 제거한다', () => {
    const md = `##   공백 제목   \n내용`;
    const sections = parseTermsIntoSections(md);
    expect(sections[0].title).toBe('공백 제목');
  });

  it('세 개 이상의 섹션도 순서대로 반환한다', () => {
    const md = `## 1조\nA\n## 2조\nB\n## 3조\nC`;
    const sections = parseTermsIntoSections(md);
    expect(sections.map(s => s.title)).toEqual(['1조', '2조', '3조']);
  });

  it('섹션 내용 앞뒤 공백을 trim한다', () => {
    const md = `## 섹션\n\n  내용  \n\n`;
    const sections = parseTermsIntoSections(md);
    expect(sections[0].content).toBe('내용');
  });
});

// ─────────────────────────────────────────────────────────
describe('loadTerms()', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('contest-hosting 타입은 올바른 경로로 fetch한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '## 약관\n내용' });
    const result = await loadTerms('contest-hosting');
    expect(global.fetch).toHaveBeenCalledWith('/resources/terms/contest-hosting-terms.md');
    expect(result).toBe('## 약관\n내용');
  });

  it('contest-join 타입은 올바른 경로로 fetch한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '' });
    await loadTerms('contest-join');
    expect(global.fetch).toHaveBeenCalledWith('/resources/terms/contest-join-terms.md');
  });

  it('privacy 타입은 올바른 경로로 fetch한다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, text: async () => '' });
    await loadTerms('privacy');
    expect(global.fetch).toHaveBeenCalledWith('/resources/terms/privacy-policy.md');
  });

  it('응답이 ok가 아니면 "약관을 불러올 수 없습니다." 에러를 던진다', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 404 });
    await expect(loadTerms('privacy')).rejects.toThrow('약관을 불러올 수 없습니다.');
  });

  it('네트워크 오류 시 "약관을 불러올 수 없습니다." 에러를 던진다', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network error'));
    await expect(loadTerms('privacy')).rejects.toThrow('약관을 불러올 수 없습니다.');
  });
});
