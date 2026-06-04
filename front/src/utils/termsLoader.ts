interface TermsSection {
  title: string;
  content: string;
}

/**
 * 약관 마크다운 파일을 로드합니다
 */
export async function loadTerms(type: 'contest-hosting' | 'contest-join' | 'privacy'): Promise<string> {
  const filePath = `/resources/terms/${
    type === 'contest-hosting' ? 'contest-hosting-terms.md' :
    type === 'contest-join' ? 'contest-join-terms.md' :
    'privacy-policy.md'
  }`;

  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load terms: ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error('약관 로드 실패:', error);
    throw new Error('약관을 불러올 수 없습니다.');
  }
}

/**
 * 마크다운 약관을 섹션 단위로 파싱합니다
 * ## 제목을 기준으로 섹션을 나눕니다
 */
export function parseTermsIntoSections(markdown: string): TermsSection[] {
  const sections: TermsSection[] = [];

  // ## 제목으로 섹션 분리
  const lines = markdown.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      // 이전 섹션 저장
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n').trim(),
        });
      }
      // 새 섹션 시작
      currentTitle = line.replace(/^## /, '').trim();
      currentContent = [];
    } else if (line.startsWith('# ')) {
      // H1 제목은 무시 (타이틀)
      continue;
    } else {
      currentContent.push(line);
    }
  }

  // 마지막 섹션 저장
  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections.filter(s => s.content.trim().length > 0);
}
