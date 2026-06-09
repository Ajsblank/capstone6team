import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AppProvider, useApp, User } from './AppContext';

jest.mock('../api/authApi', () => ({
  logoutApi: jest.fn().mockResolvedValue(undefined),
  getAccessToken: jest.fn().mockReturnValue(null),
  getUserId: jest.fn().mockReturnValue(null),
  getUsername: jest.fn().mockReturnValue(null),
}));

jest.mock('../api/sseApi', () => ({
  ensureSseConnected: jest.fn(),
  unsubscribeFromResults: jest.fn(),
}));

jest.mock('../components/ProfileBadge', () => ({
  clearMyProfileCache: jest.fn(),
}));

// context를 act 블록 안에서 직접 호출하기 위한 ref 패턴
let contextRef: ReturnType<typeof useApp>;

const TestConsumer: React.FC = () => {
  contextRef = useApp();
  return (
    <div>
      <span data-testid="username">{contextRef.user?.username ?? 'guest'}</span>
      <span data-testid="page">{contextRef.currentPage}</span>
      <span data-testid="joined">{contextRef.joinedContestIds.join(',')}</span>
      <span data-testid="hosted">{contextRef.hostedContestIds.join(',')}</span>
      <span data-testid="created">{contextRef.createdContestIds.join(',')}</span>
    </div>
  );
};

const renderWithProvider = () =>
  render(<AppProvider><TestConsumer /></AppProvider>);

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
  jest.clearAllMocks();
});

describe('초기 상태', () => {
  it('user는 null, page는 landing이다', () => {
    renderWithProvider();
    expect(screen.getByTestId('username').textContent).toBe('guest');
    expect(screen.getByTestId('page').textContent).toBe('landing');
  });

  it('로그인 상태(토큰 존재)에서 localStorage의 joinedContests를 초기값으로 읽는다', () => {
    // user가 null이면 useEffect가 contest IDs를 즉시 초기화하므로,
    // 실제 시나리오인 "토큰이 있는 채로 페이지 새로고침"을 재현한다
    const authApi = require('../api/authApi');
    authApi.getAccessToken.mockReturnValue('existing-token');
    authApi.getUserId.mockReturnValue('user_1');
    authApi.getUsername.mockReturnValue('alice');
    localStorage.setItem('joinedContests', JSON.stringify([1, 2, 3]));

    renderWithProvider();

    expect(screen.getByTestId('joined').textContent).toBe('1,2,3');

    authApi.getAccessToken.mockReturnValue(null);
    authApi.getUserId.mockReturnValue(null);
    authApi.getUsername.mockReturnValue(null);
  });

  it('localStorage 값이 깨진 JSON이면 빈 배열로 초기화한다', () => {
    localStorage.setItem('joinedContests', 'not-json');
    renderWithProvider();
    expect(screen.getByTestId('joined').textContent).toBe('');
  });
});

describe('login()', () => {
  it('user 상태를 업데이트한다', () => {
    renderWithProvider();
    const mockUser: User = { id: '1', username: 'alice', email: 'alice@test.com' };

    act(() => { contextRef.login(mockUser, [10, 20], [], [30]); });

    expect(screen.getByTestId('username').textContent).toBe('alice');
    expect(screen.getByTestId('joined').textContent).toBe('10,20');
    expect(screen.getByTestId('created').textContent).toBe('30');
  });

  it('contestIds를 localStorage에 저장한다', () => {
    renderWithProvider();

    act(() => { contextRef.login({ id: '1', username: 'alice' }, [5, 6], [7], [8]); });

    expect(JSON.parse(localStorage.getItem('joinedContests')!)).toEqual([5, 6]);
    expect(JSON.parse(localStorage.getItem('hostedContests')!)).toEqual([7]);
    expect(JSON.parse(localStorage.getItem('createdContests')!)).toEqual([8]);
  });

  it('인수 없이 호출하면 빈 배열로 초기화한다', () => {
    renderWithProvider();

    act(() => { contextRef.login({ id: '1', username: 'alice' }); });

    expect(screen.getByTestId('joined').textContent).toBe('');
    expect(screen.getByTestId('hosted').textContent).toBe('');
    expect(screen.getByTestId('created').textContent).toBe('');
  });
});

describe('logout()', () => {
  it('user를 null로 만든다', async () => {
    renderWithProvider();
    act(() => { contextRef.login({ id: '1', username: 'alice' }, [10]); });

    await act(async () => { await contextRef.logout(); });

    expect(screen.getByTestId('username').textContent).toBe('guest');
    expect(screen.getByTestId('joined').textContent).toBe('');
  });

  it('localStorage의 contest 정보를 제거한다', async () => {
    renderWithProvider();
    act(() => { contextRef.login({ id: '1', username: 'alice' }, [10], [20], [30]); });

    await act(async () => { await contextRef.logout(); });

    expect(localStorage.getItem('joinedContests')).toBeNull();
    expect(localStorage.getItem('hostedContests')).toBeNull();
    expect(localStorage.getItem('createdContests')).toBeNull();
  });
});

describe('addJoinedContest()', () => {
  it('새 대회 ID를 목록에 추가한다', () => {
    renderWithProvider();
    act(() => { contextRef.addJoinedContest(99); });
    expect(screen.getByTestId('joined').textContent).toBe('99');
  });

  it('이미 있는 ID는 중복 추가하지 않는다', () => {
    renderWithProvider();
    act(() => { contextRef.addJoinedContest(99); });
    act(() => { contextRef.addJoinedContest(99); });
    expect(screen.getByTestId('joined').textContent).toBe('99');
  });

  it('localStorage에도 반영된다', () => {
    renderWithProvider();
    act(() => { contextRef.addJoinedContest(42); });
    expect(JSON.parse(localStorage.getItem('joinedContests')!)).toContain(42);
  });
});

describe('addCreatedContest()', () => {
  it('새 대회 ID를 목록에 추가한다', () => {
    renderWithProvider();
    act(() => { contextRef.addCreatedContest(55); });
    expect(screen.getByTestId('created').textContent).toBe('55');
  });

  it('이미 있는 ID는 중복 추가하지 않는다', () => {
    renderWithProvider();
    act(() => { contextRef.addCreatedContest(55); });
    act(() => { contextRef.addCreatedContest(55); });
    expect(screen.getByTestId('created').textContent).toBe('55');
  });
});

describe('navigate()', () => {
  it('currentPage를 지정한 페이지로 변경한다', () => {
    renderWithProvider();
    act(() => { contextRef.navigate('home'); });
    expect(screen.getByTestId('page').textContent).toBe('home');
  });

  it('window.location.hash를 업데이트한다', () => {
    renderWithProvider();
    act(() => { contextRef.navigate('login'); });
    expect(window.location.hash).toBe('#login');
  });
});

describe('auth:logout 이벤트', () => {
  it('이벤트 발생 시 강제 로그아웃된다', async () => {
    renderWithProvider();
    act(() => { contextRef.login({ id: '1', username: 'alice' }); });
    expect(screen.getByTestId('username').textContent).toBe('alice');

    act(() => { window.dispatchEvent(new CustomEvent('auth:logout')); });

    await waitFor(() => {
      expect(screen.getByTestId('username').textContent).toBe('guest');
    });
  });
});

describe('useApp()', () => {
  it('AppProvider 외부에서 사용하면 에러를 던진다', () => {
    const BrokenConsumer = () => { useApp(); return null; };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BrokenConsumer />)).toThrow('useApp must be used within AppProvider');
    spy.mockRestore();
  });
});

describe('SSE 연결 관리', () => {
  it('login() 후 ensureSseConnected가 해당 userId로 호출된다', async () => {
    const { ensureSseConnected } = require('../api/sseApi');
    renderWithProvider();
    ensureSseConnected.mockClear(); // 초기 render 시 user=null로 인한 호출 이력 초기화

    await act(async () => {
      contextRef.login({ id: 'user_42', username: 'alice' });
    });

    expect(ensureSseConnected).toHaveBeenCalledWith('user_42');
    expect(ensureSseConnected).toHaveBeenCalledTimes(1);
  });

  it('logout() 후 unsubscribeFromResults가 호출된다', async () => {
    const { unsubscribeFromResults } = require('../api/sseApi');
    renderWithProvider();

    await act(async () => {
      contextRef.login({ id: 'user_42', username: 'alice' });
    });
    unsubscribeFromResults.mockClear(); // login 이전 호출 이력 초기화

    await act(async () => {
      await contextRef.logout();
    });

    expect(unsubscribeFromResults).toHaveBeenCalledTimes(1);
  });

  it('auth:logout 이벤트 발생 시에도 unsubscribeFromResults가 호출된다', async () => {
    const { unsubscribeFromResults } = require('../api/sseApi');
    renderWithProvider();

    await act(async () => {
      contextRef.login({ id: 'user_42', username: 'alice' });
    });
    unsubscribeFromResults.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    });

    await waitFor(() => {
      expect(unsubscribeFromResults).toHaveBeenCalledTimes(1);
    });
  });
});
