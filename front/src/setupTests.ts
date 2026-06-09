import '@testing-library/jest-dom';

class MockEventSource {
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  close = jest.fn();
  onmessage: null = null;
  onerror: null = null;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(public url: string) {}
}

(global as any).EventSource = MockEventSource;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});
