
import { parseMetadata } from './metadataParser';

// Duplicated from App.tsx/backupManager.ts to avoid circular deps if they exist, 
// or simpler to just redefine for clean utility.
interface Script {
    id: string;
    name: string;
    code: string;
    enabled: boolean;
    lastSavedCode: string;
    grantedPermissions: string[];
    installDate: number;
}

export async function processScriptContent(content: string): Promise<Script> {
    const metadata = parseMetadata(content);
    return {
        id: crypto.randomUUID(),
        name: metadata.name || 'Imported Script',
        code: content,
        enabled: true,
        lastSavedCode: content,
        grantedPermissions: metadata.grant || [],
        installDate: Date.now()
    };
}

export async function importFromFileLegacy(): Promise<Script[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.user.js,.js';
        input.multiple = true;
        input.style.display = 'none';

        input.onchange = async () => {
            const files = Array.from(input.files || []);
            const scripts: Script[] = [];
            for (const file of files) {
                const text = await file.text();
                scripts.push(await processScriptContent(text));
            }
            resolve(scripts);
            input.remove();
        };
        input.oncancel = () => { // Note: cancel event might not fire in all older browsers but good for modern
            resolve([]);
            input.remove();
        };

        document.body.appendChild(input);
        input.click();
    });
}

export async function importFromFile(): Promise<Script[]> {
    if (!('showOpenFilePicker' in window)) {
        return importFromFileLegacy();
    }

    let handles;
    try {
        handles = await window.showOpenFilePicker({
            types: [{ description: 'User Scripts', accept: { 'text/javascript': ['.user.js', '.js'] } }],
            multiple: true
        });
    } catch (e) {
        if ((e as Error).name === 'AbortError') return [];
        throw e;
    }

    const scripts: Script[] = [];
    for (const handle of handles) {
        const file = await handle.getFile();
        const text = await file.text();
        scripts.push(await processScriptContent(text));
    }
    return scripts;
}

export async function importFromDirectoryLegacy(): Promise<Script[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        // Non-standard attributes for directory selection
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.multiple = true;
        input.style.display = 'none';

        input.onchange = async () => {
            const files = Array.from(input.files || []);
            const scripts: Script[] = [];
            for (const file of files) {
                if (file.name.endsWith('.user.js') || file.name.endsWith('.js')) {
                    const text = await file.text();
                    if (text.includes('==UserScript==')) {
                        scripts.push(await processScriptContent(text));
                    }
                }
            }
            resolve(scripts);
            input.remove();
        };
        input.oncancel = () => {
            resolve([]);
            input.remove();
        };

        document.body.appendChild(input);
        input.click();
    });
}

export async function importFromDirectory(): Promise<Script[]> {
    if (!('showDirectoryPicker' in window)) {
        return importFromDirectoryLegacy();
    }

    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker();
    } catch (e) {
        if ((e as Error).name === 'AbortError') return [];
        throw e;
    }

    const scripts: Script[] = [];

    for await (const [name, entry] of dirHandle.entries()) {
        if (entry.kind === 'file' && (name.endsWith('.user.js') || name.endsWith('.js'))) {
            const file = await entry.getFile();
            const text = await file.text();
            // Basic validation - check for UserScript block?
            if (text.includes('==UserScript==')) {
                scripts.push(await processScriptContent(text));
            }
        }
    }
    return scripts;
}
