import { openDB } from 'idb';

const DB_NAME = 'shieldmonkey-db';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'backup-directory-handle';

export async function initDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
    const db = await initDB();
    await db.put(STORE_NAME, handle, HANDLE_KEY);
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    const db = await initDB();
    return db.get(STORE_NAME, HANDLE_KEY);
}

export async function verifyPermission(handle: FileSystemDirectoryHandle, readWrite: boolean = false): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = { mode: readWrite ? 'readwrite' : 'read' };

    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }

    if ((await handle.requestPermission(options)) === 'granted') {
        return true;
    }

    return false;
}
