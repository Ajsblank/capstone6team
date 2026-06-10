import { setContestDraft, getContestDraft, clearContestDraft } from './contestDraft';
import { CreateContestData } from './api/contestApi';

const makeDraft = (): CreateContestData => ({
  title: '테스트 대회',
  description: '설명',
  certification: false,
  timeLimitSec: 2,
  memoryLimitMb: 256,
  sampleCodes: [],
  judgeCode: new File([''], 'judge.cpp'),
  exampleAiCodes: [],
  visualizationHtml: null,
  soloPlayHtml: null,
  status: 'TEST',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  maxParticipants: 10,
  creatorId: 1,
});

afterEach(() => {
  clearContestDraft();
});

// ─────────────────────────────────────────────────────────
describe('getContestDraft()', () => {
  it('초기 상태에서는 null을 반환한다', () => {
    expect(getContestDraft()).toBeNull();
  });
});

describe('setContestDraft / getContestDraft', () => {
  it('저장 후 조회하면 동일한 객체 참조를 반환한다', () => {
    const draft = makeDraft();
    setContestDraft(draft);
    expect(getContestDraft()).toBe(draft);
  });

  it('덮어쓰기 시 마지막 값을 반환한다', () => {
    setContestDraft(makeDraft());
    const second = { ...makeDraft(), title: '두 번째 대회' };
    setContestDraft(second);
    expect(getContestDraft()?.title).toBe('두 번째 대회');
  });

  it('다른 필드도 그대로 보존한다', () => {
    const draft = makeDraft();
    setContestDraft(draft);
    const retrieved = getContestDraft();
    expect(retrieved?.certification).toBe(false);
    expect(retrieved?.maxParticipants).toBe(10);
    expect(retrieved?.creatorId).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────
describe('clearContestDraft()', () => {
  it('저장 후 삭제하면 null을 반환한다', () => {
    setContestDraft(makeDraft());
    clearContestDraft();
    expect(getContestDraft()).toBeNull();
  });

  it('값이 없는 상태에서 호출해도 에러가 발생하지 않는다', () => {
    expect(() => clearContestDraft()).not.toThrow();
  });

  it('삭제 후 다시 저장하면 새 값을 반환한다', () => {
    setContestDraft(makeDraft());
    clearContestDraft();
    const newDraft = { ...makeDraft(), title: '새 대회' };
    setContestDraft(newDraft);
    expect(getContestDraft()?.title).toBe('새 대회');
  });
});
