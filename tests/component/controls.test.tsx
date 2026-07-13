import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToggleSwitch from '../../src/sandbox/options/components/ToggleSwitch';
import Modal from '../../src/sandbox/options/Modal';
import { BridgeClient } from '../../src/sandbox/bridge/client';

afterEach(cleanup);

describe('accessible controls', () => {
    test('switch exposes and updates its state', async () => {
        const onChange = vi.fn();
        render(<ToggleSwitch checked={false} onChange={onChange} ariaLabel="Enable Example" />);
        const control = screen.getByRole('switch', { name: 'Enable Example' });
        expect(control.getAttribute('aria-checked')).toBe('false');
        await userEvent.click(control);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    test('switch supports keyboard input and exposes disabled state', async () => {
        const onChange = vi.fn();
        const { rerender } = render(<ToggleSwitch checked={false} onChange={onChange} ariaLabel="Enable automatic backup" />);
        const control = screen.getByRole('switch', { name: 'Enable automatic backup' });
        control.focus();
        await userEvent.keyboard(' ');
        expect(onChange).toHaveBeenCalledWith(true);

        rerender(<ToggleSwitch checked={false} onChange={onChange} ariaLabel="Enable automatic backup" disabled />);
        expect(control.hasAttribute('disabled')).toBe(true);
    });

    test('confirmation dialog supports keyboard cancellation and focus return', () => {
        const onClose = vi.fn();
        const trigger = document.createElement('button');
        document.body.appendChild(trigger);
        trigger.focus();
        render(<Modal isOpen type="confirm" title="Delete script" message="This cannot be undone." onClose={onClose} onConfirm={vi.fn()} />);
        expect(screen.getByRole('alertdialog')).toBeTruthy();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
        trigger.remove();
    });
});

describe('sandbox bridge lifecycle', () => {
    test('times out and releases pending requests', async () => {
        vi.useFakeTimers();
        const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined);
        const client = new BridgeClient();
        const request = client.call('GET_SETTINGS');
        let rejection: unknown;
        const settled = request.catch(error => { rejection = error; });

        expect(client.pendingRequestCount).toBe(1);
        await vi.advanceTimersByTimeAsync(30_000);
        await settled;
        expect(rejection).toMatchObject({ detail: { code: 'TIMEOUT', action: 'GET_SETTINGS' } });
        expect(client.pendingRequestCount).toBe(0);

        postMessage.mockRestore();
        vi.useRealTimers();
    });
});
