import type { ActionType, BridgeMessage, BridgeResponse, StorageChangeMessage } from './types';

class BridgeClient {
    private listeners: Map<string, (response: BridgeResponse) => void> = new Map();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private storageListeners: Set<(changes: { [key: string]: any }, areaName: string) => void> = new Set();

    constructor() {
        window.addEventListener('message', this.handleMessage.bind(this));
    }

    private handleMessage(event: MessageEvent) {
        const data = event.data;
        if (!data) return;

        // Handle responses
        if (data.id && this.listeners.has(data.id)) {
            const resolver = this.listeners.get(data.id);
            if (resolver) {
                resolver(data as BridgeResponse);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async call<T = any>(type: ActionType, payload?: any): Promise<T> {
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            this.listeners.set(id, (response: BridgeResponse) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.result as T);
                }
            });

            // Target origin * is acceptable here because we are the child sending to parent
            // But ideally we should know the parent origin. 
            // In extension, parent is chrome-extension://<id>
            window.parent.postMessage({ id, type, payload } as BridgeMessage, '*');
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public onStorageChanged(callback: (changes: { [key: string]: any }, areaName: string) => void) {
        this.storageListeners.add(callback);
        return () => this.storageListeners.delete(callback);
    }
}

export const bridge = new BridgeClient();
