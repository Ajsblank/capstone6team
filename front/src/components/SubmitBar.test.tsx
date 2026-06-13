import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmitBar from './SubmitBar';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('idle 상태', () => {
  it('상태 메시지가 표시되지 않는다', () => {
    render(<SubmitBar status="idle" onSubmit={jest.fn()} />);
    expect(screen.queryByText(/제출 중/)).not.toBeInTheDocument();
    expect(screen.queryByText(/완료/)).not.toBeInTheDocument();
    expect(screen.queryByText(/실패/)).not.toBeInTheDocument();
  });

  it('버튼 텍스트가 "제출하기"이다', () => {
    render(<SubmitBar status="idle" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('제출하기');
  });

  it('버튼이 활성 상태이다', () => {
    render(<SubmitBar status="idle" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────
describe('submitting 상태', () => {
  it('"제출 중..." 메시지가 표시된다', () => {
    render(<SubmitBar status="submitting" onSubmit={jest.fn()} />);
    expect(screen.getAllByText('제출 중...')).not.toHaveLength(0);
  });

  it('버튼이 비활성화된다', () => {
    render(<SubmitBar status="submitting" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────
describe('success 상태', () => {
  it('채점 대기 메시지가 표시된다', () => {
    render(<SubmitBar status="success" onSubmit={jest.fn()} />);
    expect(screen.getByText('제출 완료! 채점 결과를 기다리는 중입니다.')).toBeInTheDocument();
  });

  it('버튼이 활성 상태이다', () => {
    render(<SubmitBar status="success" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('버튼 텍스트가 "제출하기"이다', () => {
    render(<SubmitBar status="success" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('제출하기');
  });
});

// ─────────────────────────────────────────────────────────
describe('error 상태', () => {
  it('errorMessage가 없으면 기본 에러 메시지를 표시한다', () => {
    render(<SubmitBar status="error" onSubmit={jest.fn()} />);
    expect(screen.getByText('제출에 실패했습니다. 다시 시도해주세요.')).toBeInTheDocument();
  });

  it('errorMessage가 있으면 커스텀 메시지를 표시한다', () => {
    render(<SubmitBar status="error" errorMessage="서버 오류: 500" onSubmit={jest.fn()} />);
    expect(screen.getByText('서버 오류: 500')).toBeInTheDocument();
  });

  it('errorMessage가 있으면 기본 에러 메시지는 표시되지 않는다', () => {
    render(<SubmitBar status="error" errorMessage="커스텀 메시지" onSubmit={jest.fn()} />);
    expect(screen.queryByText('제출에 실패했습니다. 다시 시도해주세요.')).not.toBeInTheDocument();
  });

  it('버튼이 활성 상태이다', () => {
    render(<SubmitBar status="error" onSubmit={jest.fn()} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────
describe('버튼 클릭', () => {
  it('idle 상태에서 클릭 시 onSubmit이 호출된다', async () => {
    const onSubmit = jest.fn();
    render(<SubmitBar status="idle" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('submitting 상태에서는 버튼이 비활성화되어 onSubmit이 호출되지 않는다', async () => {
    const onSubmit = jest.fn();
    render(<SubmitBar status="submitting" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('success 상태에서 클릭 시 onSubmit이 호출된다', async () => {
    const onSubmit = jest.fn();
    render(<SubmitBar status="success" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('error 상태에서 클릭 시 onSubmit이 호출된다', async () => {
    const onSubmit = jest.fn();
    render(<SubmitBar status="error" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
