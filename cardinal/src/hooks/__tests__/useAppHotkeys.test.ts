import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { subscribeQuickLookKeydown } from '../../runtime/tauriEventRuntime';
import { openResultPath } from '../../utils/openResultPath';
import { useAppHotkeys } from '../useAppHotkeys';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../runtime/tauriEventRuntime', () => ({
  subscribeQuickLookKeydown: vi.fn(),
}));

vi.mock('../../utils/openResultPath', () => ({
  openResultPath: vi.fn(),
}));

const mockedSubscribeQuickLookKeydown = vi.mocked(subscribeQuickLookKeydown);
const mockedInvoke = vi.mocked(invoke);
const mockedOpenResultPath = vi.mocked(openResultPath);

type HookProps = {
  activeTab: 'files' | 'events';
  activeRowIndex: number | null;
  selectedPaths: string[];
  selectedIndicesRef: { current: number[] };
  focusSearchInput: () => void;
  focusAndSelectSearchInput: () => void;
  clearSelection: () => void;
  navigateSelection: (delta: 1 | -1, options?: { extend?: boolean }) => void;
  triggerQuickLook: () => void;
};

describe('useAppHotkeys', () => {
  const quickLookUnlisten = vi.fn();
  const focusSearchInput = vi.fn();
  const focusAndSelectSearchInput = vi.fn();
  const clearSelection = vi.fn();
  const navigateSelection = vi.fn();
  const triggerQuickLook = vi.fn();

  let quickLookListener: ((payload: any) => void) | null;

  const renderHotkeys = (overrides: Partial<HookProps> = {}) =>
    renderHook((props: HookProps) => useAppHotkeys(props), {
      initialProps: {
        activeTab: 'files',
        activeRowIndex: 1,
        selectedPaths: ['/tmp/a', '/tmp/b'],
        selectedIndicesRef: { current: [0] },
        focusSearchInput,
        focusAndSelectSearchInput,
        clearSelection,
        navigateSelection,
        triggerQuickLook,
        ...overrides,
      },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    quickLookListener = null;
    mockedInvoke.mockResolvedValue(undefined);

    mockedSubscribeQuickLookKeydown.mockImplementation((listener) => {
      quickLookListener = listener;
      return quickLookUnlisten;
    });
  });

  it('handles Meta+F, Meta+R, Meta+O, and Meta+C shortcuts on files tab', async () => {
    renderHotkeys();

    const findEvent = new KeyboardEvent('keydown', {
      key: 'f',
      metaKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(findEvent);
    });
    expect(focusAndSelectSearchInput).toHaveBeenCalledTimes(1);
    expect(findEvent.defaultPrevented).toBe(true);

    const openEvent = new KeyboardEvent('keydown', {
      key: 'o',
      metaKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(openEvent);
    });
    expect(mockedOpenResultPath).toHaveBeenCalledWith('/tmp/a');
    expect(mockedOpenResultPath).toHaveBeenCalledWith('/tmp/b');

    const revealEvent = new KeyboardEvent('keydown', {
      key: 'r',
      metaKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(revealEvent);
    });
    expect(mockedInvoke).toHaveBeenCalledWith('open_in_finder', { path: '/tmp/a' });
    expect(mockedInvoke).toHaveBeenCalledWith('open_in_finder', { path: '/tmp/b' });

    const copyEvent = new KeyboardEvent('keydown', {
      key: 'c',
      metaKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(copyEvent);
    });
    expect(mockedInvoke).toHaveBeenCalledWith('copy_files_to_clipboard', {
      paths: ['/tmp/a', '/tmp/b'],
    });
  });

  it('opens the selected results on Enter', () => {
    renderHotkeys();

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    act(() => {
      window.dispatchEvent(enterEvent);
    });

    expect(mockedOpenResultPath).toHaveBeenCalledTimes(2);
    expect(mockedOpenResultPath).toHaveBeenCalledWith('/tmp/a');
    expect(mockedOpenResultPath).toHaveBeenCalledWith('/tmp/b');
    expect(enterEvent.defaultPrevented).toBe(true);

    const repeatEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      repeat: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(repeatEvent);
    });

    expect(mockedOpenResultPath).toHaveBeenCalledTimes(2);
  });

  it('ignores Enter without a selection, with modifiers, or outside the files tab', () => {
    const { rerender } = renderHotkeys({ selectedPaths: [] });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    });

    rerender({
      activeTab: 'files',
      activeRowIndex: 1,
      selectedPaths: ['/tmp/a'],
      selectedIndicesRef: { current: [0] },
      focusSearchInput,
      focusAndSelectSearchInput,
      clearSelection,
      navigateSelection,
      triggerQuickLook,
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true }),
      );
    });

    rerender({
      activeTab: 'events',
      activeRowIndex: 1,
      selectedPaths: ['/tmp/a'],
      selectedIndicesRef: { current: [0] },
      focusSearchInput,
      focusAndSelectSearchInput,
      clearSelection,
      navigateSelection,
      triggerQuickLook,
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    });

    expect(mockedOpenResultPath).not.toHaveBeenCalled();
  });

  it('leaves Enter to the search input and to focused buttons', () => {
    renderHotkeys();

    const input = document.createElement('input');
    const button = document.createElement('button');
    document.body.append(input, button);

    const inputEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
      bubbles: true,
    });
    const buttonEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      input.dispatchEvent(inputEnter);
      button.dispatchEvent(buttonEnter);
    });

    expect(mockedOpenResultPath).not.toHaveBeenCalled();
    expect(inputEnter.defaultPrevented).toBe(false);
    expect(buttonEnter.defaultPrevented).toBe(false);

    input.remove();
    button.remove();
  });

  it('does not override native copy shortcuts inside editable fields', () => {
    renderHotkeys();

    const input = document.createElement('input');
    document.body.appendChild(input);

    const copyEvent = new KeyboardEvent('keydown', {
      key: 'c',
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });

    act(() => {
      input.dispatchEvent(copyEvent);
    });

    expect(mockedInvoke).not.toHaveBeenCalledWith('copy_files_to_clipboard', {
      paths: ['/tmp/a', '/tmp/b'],
    });
    expect(copyEvent.defaultPrevented).toBe(false);

    input.remove();
  });

  it('still routes Meta+F to the app search input from editable fields', () => {
    renderHotkeys();

    const input = document.createElement('input');
    document.body.appendChild(input);

    const findEvent = new KeyboardEvent('keydown', {
      key: 'f',
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });

    act(() => {
      input.dispatchEvent(findEvent);
    });

    expect(focusAndSelectSearchInput).toHaveBeenCalledTimes(1);
    expect(findEvent.defaultPrevented).toBe(true);

    input.remove();
  });

  it('handles space and arrow navigation on files tab', () => {
    renderHotkeys();

    const spaceEvent = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(spaceEvent);
    });
    expect(triggerQuickLook).toHaveBeenCalledTimes(1);
    expect(spaceEvent.defaultPrevented).toBe(true);

    const downEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      shiftKey: true,
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(downEvent);
    });
    expect(navigateSelection).toHaveBeenCalledWith(1, { extend: true });

    const upEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(upEvent);
    });
    expect(navigateSelection).toHaveBeenCalledWith(-1, { extend: false });
  });

  it('returns focus to the search input when navigating up from the first result', () => {
    renderHotkeys({ activeRowIndex: 0 });

    const upEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      cancelable: true,
    });
    act(() => {
      window.dispatchEvent(upEvent);
    });

    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(focusSearchInput).toHaveBeenCalledTimes(1);
    expect(focusAndSelectSearchInput).not.toHaveBeenCalled();
    expect(navigateSelection).not.toHaveBeenCalled();
    expect(upEvent.defaultPrevented).toBe(true);
  });

  it('handles Quick Look runtime keydown events and cleanup', async () => {
    const { rerender, unmount } = renderHotkeys();

    await waitFor(() => {
      expect(quickLookListener).not.toBeNull();
    });

    act(() => {
      quickLookListener?.({
        keyCode: 125,
        modifiers: {
          shift: true,
          control: false,
          option: false,
          command: false,
        },
      });
    });
    expect(navigateSelection).toHaveBeenCalledWith(1, { extend: true });

    rerender({
      activeTab: 'events',
      activeRowIndex: 0,
      selectedPaths: ['/tmp/a', '/tmp/b'],
      selectedIndicesRef: { current: [0] },
      focusSearchInput,
      focusAndSelectSearchInput,
      clearSelection,
      navigateSelection,
      triggerQuickLook,
    });

    navigateSelection.mockClear();
    act(() => {
      quickLookListener?.({
        keyCode: 126,
        modifiers: {
          shift: false,
          control: false,
          option: false,
          command: false,
        },
      });
    });
    expect(navigateSelection).not.toHaveBeenCalled();

    unmount();
    expect(quickLookUnlisten).toHaveBeenCalled();
  });
});
