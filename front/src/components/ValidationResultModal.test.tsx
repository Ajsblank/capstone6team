import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ValidationResultModal from './ValidationResultModal';
import { ValidationResult } from '../api/validationApi';

const defaultProps = {
  isOpen: true,
  result: null as ValidationResult | null,
  isLoading: false,
  onClose: jest.fn(),
  onRetry: jest.fn(),
};

const successResult: ValidationResult = {
  passed: true,
  details: [
    { target: '샘플 AI #1', passed: true, log: '' },
  ],
};

const failResult: ValidationResult = {
  passed: false,
  details: [
    { target: '샘플 AI #1', passed: false, log: '오류 로그', reason: '시간 초과' },
    { target: '샘플 AI #2', passed: true, log: '' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('isOpen=false', () => {
  it('아무것도 렌더링하지 않는다', () => {
    const { container } = render(<ValidationResultModal {...defaultProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ─────────────────────────────────────────────────────────
describe('로딩 상태', () => {
  it('"검증을 진행 중입니다..." 메시지가 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} isLoading={true} />);
    expect(screen.getByText('검증을 진행 중입니다...')).toBeInTheDocument();
  });

  it('로딩 중에는 계속하기/다시 검증 버튼이 표시되지 않는다', () => {
    render(<ValidationResultModal {...defaultProps} isLoading={true} />);
    expect(screen.queryByText('계속하기')).not.toBeInTheDocument();
    expect(screen.queryByText('다시 검증')).not.toBeInTheDocument();
  });

  it('"검증 결과" 제목이 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} isLoading={true} />);
    expect(screen.getByText('검증 결과')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe('검증 성공', () => {
  it('"검증 성공" 텍스트가 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={successResult} />);
    expect(screen.getByText('검증 성공')).toBeInTheDocument();
  });

  it('"모든 항목이 검증되었습니다." 메시지가 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={successResult} />);
    expect(screen.getByText('모든 항목이 검증되었습니다. 결제로 진행할 수 있습니다.')).toBeInTheDocument();
  });

  it('"계속하기" 버튼이 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={successResult} />);
    expect(screen.getByText('계속하기')).toBeInTheDocument();
  });

  it('"다시 검증" 버튼은 표시되지 않는다', () => {
    render(<ValidationResultModal {...defaultProps} result={successResult} />);
    expect(screen.queryByText('다시 검증')).not.toBeInTheDocument();
  });

  it('"계속하기" 클릭 시 onClose가 호출된다', async () => {
    const onClose = jest.fn();
    render(<ValidationResultModal {...defaultProps} result={successResult} onClose={onClose} />);
    await userEvent.click(screen.getByText('계속하기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('통과한 항목에 "✓ 통과" 텍스트가 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={successResult} />);
    expect(screen.getByText('✓ 통과')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe('검증 실패', () => {
  it('"검증 실패" 텍스트가 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('검증 실패')).toBeInTheDocument();
  });

  it('실패한 항목 수를 메시지에 표시한다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('1개 항목이 검증에 실패했습니다.')).toBeInTheDocument();
  });

  it('"다시 검증" 버튼이 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('다시 검증')).toBeInTheDocument();
  });

  it('"닫기" 버튼이 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('닫기')).toBeInTheDocument();
  });

  it('"계속하기" 버튼은 표시되지 않는다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.queryByText('계속하기')).not.toBeInTheDocument();
  });

  it('실패한 항목의 reason이 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('시간 초과')).toBeInTheDocument();
  });

  it('log가 있는 항목에 서버 로그가 표시된다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('오류 로그')).toBeInTheDocument();
  });

  it('"다시 검증" 클릭 시 onRetry가 호출된다', async () => {
    const onRetry = jest.fn();
    render(<ValidationResultModal {...defaultProps} result={failResult} onRetry={onRetry} />);
    await userEvent.click(screen.getByText('다시 검증'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('"닫기" 클릭 시 onClose가 호출된다', async () => {
    const onClose = jest.fn();
    render(<ValidationResultModal {...defaultProps} result={failResult} onClose={onClose} />);
    await userEvent.click(screen.getByText('닫기'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('통과/실패 항목이 모두 렌더링된다', () => {
    render(<ValidationResultModal {...defaultProps} result={failResult} />);
    expect(screen.getByText('샘플 AI #1')).toBeInTheDocument();
    expect(screen.getByText('샘플 AI #2')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe('닫기(✕) 버튼 및 오버레이', () => {
  it('✕ 버튼 클릭 시 onClose가 호출된다', async () => {
    const onClose = jest.fn();
    render(<ValidationResultModal {...defaultProps} result={successResult} onClose={onClose} />);
    await userEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('오버레이 직접 클릭 시 onClose가 호출된다', () => {
    const onClose = jest.fn();
    const { container } = render(
      <ValidationResultModal {...defaultProps} result={successResult} onClose={onClose} />
    );
    const overlay = container.querySelector('.vrm-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('모달 내부 클릭 시 onClose가 호출되지 않는다', async () => {
    const onClose = jest.fn();
    const { container } = render(
      <ValidationResultModal {...defaultProps} result={successResult} onClose={onClose} />
    );
    const modal = container.querySelector('.vrm-modal')!;
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });
});
