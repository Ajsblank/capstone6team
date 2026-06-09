import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppHeader from './AppHeader';

const mockNavigate = jest.fn();
const mockLogout = jest.fn();
let mockUser: { id: string; username: string } | null = null;

// useApp은 외부 의존성이므로 mock 처리 — user 상태는 테스트마다 교체
jest.mock('../context/AppContext', () => ({
  useApp: () => ({
    user: mockUser,
    navigate: mockNavigate,
    logout: mockLogout,
  }),
}));

// 테스트 범위 밖의 컴포넌트 mock
jest.mock('./ProfileBadge', () => ({
  __esModule: true,
  default: () => <div data-testid="profile-badge" />,
}));

jest.mock('./ResponsiveNavMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="responsive-nav" />,
}));

beforeEach(() => {
  mockUser = null;
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────
describe('비로그인 상태', () => {
  it('회원가입, 로그인 버튼이 보인다', () => {
    render(<AppHeader />);
    expect(screen.getByText('회원가입')).toBeInTheDocument();
    expect(screen.getByText('로그인')).toBeInTheDocument();
  });

  it('로그아웃 버튼은 보이지 않는다', () => {
    render(<AppHeader />);
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
  });

  it('ProfileBadge는 렌더링되지 않는다', () => {
    render(<AppHeader />);
    expect(screen.queryByTestId('profile-badge')).not.toBeInTheDocument();
  });

  it('로그인 버튼 클릭 시 login 페이지로 이동한다', async () => {
    render(<AppHeader />);
    await userEvent.click(screen.getByText('로그인'));
    expect(mockNavigate).toHaveBeenCalledWith('login');
  });

  it('회원가입 버튼 클릭 시 signup 페이지로 이동한다', async () => {
    render(<AppHeader />);
    await userEvent.click(screen.getByText('회원가입'));
    expect(mockNavigate).toHaveBeenCalledWith('signup');
  });
});

// ─────────────────────────────────────────────────────────
describe('로그인 상태', () => {
  beforeEach(() => {
    mockUser = { id: '1', username: 'alice' };
  });

  it('로그아웃 버튼이 보인다', () => {
    render(<AppHeader />);
    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });

  it('ProfileBadge가 렌더링된다', () => {
    render(<AppHeader />);
    expect(screen.getByTestId('profile-badge')).toBeInTheDocument();
  });

  it('회원가입, 로그인 버튼은 보이지 않는다', () => {
    render(<AppHeader />);
    expect(screen.queryByText('회원가입')).not.toBeInTheDocument();
    expect(screen.queryByText('로그인')).not.toBeInTheDocument();
  });

  it('로그아웃 버튼 클릭 시 logout()이 호출된다', async () => {
    render(<AppHeader />);
    await userEvent.click(screen.getByText('로그아웃'));
    expect(mockLogout).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
describe('네비게이션 탭', () => {
  it('로고 클릭 시 landing 페이지로 이동한다', async () => {
    render(<AppHeader />);
    const logo = screen.getByRole('img', { name: 'TCB' }).closest('span')!;
    await userEvent.click(logo);
    expect(mockNavigate).toHaveBeenCalledWith('landing');
  });

  it('메인 버튼 클릭 시 landing 페이지로 이동한다', async () => {
    render(<AppHeader />);
    await userEvent.click(screen.getByText('메인'));
    expect(mockNavigate).toHaveBeenCalledWith('landing');
  });

  it('홈 탭 클릭 시 navigate("home")이 호출된다', async () => {
    render(<AppHeader />);
    await userEvent.click(screen.getByText('홈'));
    expect(mockNavigate).toHaveBeenCalledWith('home');
  });

  it('문제 탭 클릭 시 navigate("problems")가 호출된다', async () => {
    render(<AppHeader />);
    await userEvent.click(screen.getByText('문제'));
    expect(mockNavigate).toHaveBeenCalledWith('problems');
  });

  it('onHomeClick prop이 있으면 홈 탭 클릭 시 onHomeClick이 호출된다', async () => {
    const onHomeClick = jest.fn();
    render(<AppHeader onHomeClick={onHomeClick} />);

    await userEvent.click(screen.getByText('홈'));

    expect(onHomeClick).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('home');
  });

  it('onContestClick prop이 있으면 대회 탭 클릭 시 onContestClick이 호출된다', async () => {
    const onContestClick = jest.fn();
    render(<AppHeader onContestClick={onContestClick} />);

    await userEvent.click(screen.getByText('대회'));

    expect(onContestClick).toHaveBeenCalled();
  });

  it('onHelpClick prop이 있으면 도움말 탭 클릭 시 onHelpClick이 호출된다', async () => {
    const onHelpClick = jest.fn();
    render(<AppHeader onHelpClick={onHelpClick} />);

    await userEvent.click(screen.getByText('도움말'));

    expect(onHelpClick).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
describe('activePage 강조 스타일', () => {
  it('activePage="home"이면 홈 탭에 활성 클래스가 붙는다', () => {
    render(<AppHeader activePage="home" />);
    expect(screen.getByText('홈')).toHaveClass('home-tab-btn--active');
  });

  it('activePage="problems"이면 문제 탭에 활성 클래스가 붙는다', () => {
    render(<AppHeader activePage="problems" />);
    expect(screen.getByText('문제')).toHaveClass('home-tab-btn--active');
  });

  it('activePage가 없으면 어떤 탭도 활성 클래스가 없다', () => {
    render(<AppHeader />);
    screen.getAllByRole('button').forEach((btn) => {
      if (['홈', '문제', '대회', '도움말'].includes(btn.textContent ?? '')) {
        expect(btn).not.toHaveClass('home-tab-btn--active');
      }
    });
  });
});
