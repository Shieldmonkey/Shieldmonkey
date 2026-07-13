import type { ActionType, BridgeActionMap, BridgeError, BridgeMessage, BridgeResponse, StorageChangeMessage } from './types';

const INTERACTIVE_ACTIONS = new Set<ActionType>(['IMPORT_FILE', 'IMPORT_DIRECTORY', 'SELECT_BACKUP_DIR', 'RUN_BACKUP', 'RUN_RESTORE']);

export class BridgeClientError extends Error {
    readonly detail: BridgeError;

    constructor(detail: BridgeError) {
        super(detail.message);
        this.detail = detail;
        this.name = 'BridgeClientError';
    }
}

export class BridgeClient {
    private listeners: Map<string, { resolve: (response: BridgeResponse) => void; timer: number }> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private storageListeners: Set<(changes: { [key: string]: any }, areaName: string) => void> = new Set();

    constructor() {
        window.addEventListener('message', this.handleMessage.bind(this));
    }

    private handleMessage(event: MessageEvent) {
        if (event.source !== window.parent) return;
        const data = event.data;
        if (!data) return;

        // Handle responses
        if (data.id && this.listeners.has(data.id)) {
            const pending = this.listeners.get(data.id);
            if (pending) {
                window.clearTimeout(pending.timer);
                pending.resolve(data as BridgeResponse);
                this.listeners.delete(data.id);
            }
            return;
        }

        // Handle events (like storage changes)
        if (data.type === 'STORAGE_CHANGED') {
            const msg = data as StorageChangeMessage;
            this.storageListeners.forEach(listener => listener(msg.changes, msg.areaName));
        }
    }

    public async call<T extends ActionType>(
        type: T,
        ...args: BridgeActionMap[T]['payload'] extends undefined ? [payload?: undefined] : [payload: BridgeActionMap[T]['payload']]
    ): Promise<BridgeActionMap[T]['response']> {
        const payload = args[0];
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const timeout = INTERACTIVE_ACTIONS.has(type) ? 15 * 60_000 : 30_000;
            const timer = window.setTimeout(() => {
                this.listeners.delete(id);
                reject(new BridgeClientError({ code: 'TIMEOUT', message: `The ${type} request timed out.`, action: type }));
            }, timeout);
            this.listeners.set(id, { timer, resolve: (response: BridgeResponse) => {
                if (response.error) {
                    reject(new BridgeClientError(response.error));
                } else {
                    resolve(response.result as BridgeActionMap[T]['response']);
                }
            }});

            // Target origin * is acceptable here because we are the child sending to parent
            // But ideally we should know the parent origin. 
            // In extension, parent is chrome-extension://<id>
            window.parent.postMessage({ id, type, payload } as BridgeMessage<T>, '*');
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public onStorageChanged(callback: (changes: { [key: string]: any }, areaName: string) => void) {
        this.storageListeners.add(callback);
        return () => this.storageListeners.delete(callback);
    }

    /** Exposed for lifecycle diagnostics and contract tests. */
    public get pendingRequestCount() {
        return this.listeners.size;
    }
}

export const bridge = new BridgeClient();
