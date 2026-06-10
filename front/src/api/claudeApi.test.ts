jest.mock('@anthropic-ai/sdk', () => ({ default: jest.fn() }));

import { stripHtml } from './claudeApi';

describe('stripHtml()', () => {
  it('HTML 태그를 제거하고 텍스트만 남긴다', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('여러 태그가 있어도 모두 제거한다', () => {
    expect(stripHtml('<h1>Title</h1><p>Content</p>')).toBe('Title Content');
  });

  it('중첩 태그를 모두 제거한다', () => {
    expect(stripHtml('<div><span><strong>deep</strong></span></div>')).toBe('deep');
  });

  it('속성이 있는 태그도 제거한다', () => {
    expect(stripHtml('<a href="http://example.com">링크</a>')).toBe('링크');
  });

  it('태그 없는 순수 텍스트는 그대로 반환한다', () => {
    expect(stripHtml('plain text')).toBe('plain text');
  });

  it('빈 문자열 입력 시 빈 문자열을 반환한다', () => {
    expect(stripHtml('')).toBe('');
  });

  it('연속 공백을 하나의 공백으로 정규화한다', () => {
    expect(stripHtml('<p>word1</p>   <p>word2</p>')).toBe('word1 word2');
  });

  it('앞뒤 공백을 trim한다', () => {
    expect(stripHtml('  <p>text</p>  ')).toBe('text');
  });

  it('태그만 있고 텍스트가 없으면 빈 문자열을 반환한다', () => {
    expect(stripHtml('<br/><hr/>')).toBe('');
  });
});
