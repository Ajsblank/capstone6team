import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CodeEditor, { LANGUAGE_DEFAULTS } from './CodeEditor';
import { Language } from '../types';

// Monaco Editor는 브라우저 환경이 필요하므로 jsdom에서 동작하지 않아 mock 처리
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (val: string | undefined) => void;
  }) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const defaultProps = {
  language: 'python' as Language,
  code: '# 기본 코드',
  onLanguageChange: jest.fn(),
  onCodeChange: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('렌더링', () => {
  it('언어 선택 드롭다운이 렌더링된다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('C++, Java, Python 세 가지 옵션이 있다', () => {
    render(<CodeEditor {...defaultProps} />);
    const options = screen.getAllByRole('option');
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain('C++');
    expect(labels).toContain('Java');
    expect(labels).toContain('Python');
  });

  it('language prop이 select의 현재 값으로 표시된다', () => {
    render(<CodeEditor {...defaultProps} language="java" />);
    expect(screen.getByRole('combobox')).toHaveValue('java');
  });

  it('code prop이 Monaco Editor에 전달된다', () => {
    render(<CodeEditor {...defaultProps} code="print('hello')" />);
    expect(screen.getByTestId('monaco-editor')).toHaveValue("print('hello')");
  });

  it('언어 선택 레이블이 표시된다', () => {
    render(<CodeEditor {...defaultProps} />);
    expect(screen.getByText('언어 선택')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe('언어 변경', () => {
  it('언어 선택 시 onLanguageChange가 새 언어로 호출된다', async () => {
    const onLanguageChange = jest.fn();
    render(<CodeEditor {...defaultProps} onLanguageChange={onLanguageChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'cpp');

    expect(onLanguageChange).toHaveBeenCalledWith('cpp');
  });

  it('언어 변경 시 onCodeChange가 해당 언어의 기본 코드로 호출된다', async () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} onCodeChange={onCodeChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'java');

    expect(onCodeChange).toHaveBeenCalledWith(LANGUAGE_DEFAULTS['java']);
  });

  it('python 선택 시 python 기본 코드로 onCodeChange가 호출된다', async () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} language="cpp" onCodeChange={onCodeChange} />);

    await userEvent.selectOptions(screen.getByRole('combobox'), 'python');

    expect(onCodeChange).toHaveBeenCalledWith(LANGUAGE_DEFAULTS['python']);
  });

  it('onLanguageChange와 onCodeChange가 동시에 호출된다', async () => {
    const onLanguageChange = jest.fn();
    const onCodeChange = jest.fn();
    render(
      <CodeEditor
        {...defaultProps}
        onLanguageChange={onLanguageChange}
        onCodeChange={onCodeChange}
      />
    );

    await userEvent.selectOptions(screen.getByRole('combobox'), 'cpp');

    expect(onLanguageChange).toHaveBeenCalledTimes(1);
    expect(onCodeChange).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────
describe('에디터 값 변경', () => {
  it('에디터 내용 변경 시 onCodeChange가 호출된다', async () => {
    const onCodeChange = jest.fn();
    render(<CodeEditor {...defaultProps} onCodeChange={onCodeChange} />);

    await userEvent.type(screen.getByTestId('monaco-editor'), 'x = 1');

    expect(onCodeChange).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
describe('LANGUAGE_DEFAULTS', () => {
  it('cpp, java, python 세 가지 기본 코드가 정의되어 있다', () => {
    expect(LANGUAGE_DEFAULTS).toHaveProperty('cpp');
    expect(LANGUAGE_DEFAULTS).toHaveProperty('java');
    expect(LANGUAGE_DEFAULTS).toHaveProperty('python');
  });

  it('각 기본 코드는 빈 문자열이 아니다', () => {
    expect(LANGUAGE_DEFAULTS['cpp'].length).toBeGreaterThan(0);
    expect(LANGUAGE_DEFAULTS['java'].length).toBeGreaterThan(0);
    expect(LANGUAGE_DEFAULTS['python'].length).toBeGreaterThan(0);
  });

  it('cpp 기본 코드에 main 함수가 포함된다', () => {
    expect(LANGUAGE_DEFAULTS['cpp']).toContain('main');
  });

  it('java 기본 코드에 public class가 포함된다', () => {
    expect(LANGUAGE_DEFAULTS['java']).toContain('public class');
  });

  it('python 기본 코드에 def가 포함된다', () => {
    expect(LANGUAGE_DEFAULTS['python']).toContain('def');
  });
});
