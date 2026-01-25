

const PermissionHelp = () => {
    // Calculate Chrome version directly since userAgent is constant
    const chromeVersion = (() => {
        const match = navigator.userAgent.match(/Chrome\/(\d+)/);
        return (match && match[1]) ? parseInt(match[1], 10) : 0;
    })();

    const openExtensionsPage = () => {
        if (chrome.tabs) {
            chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
        } else {
            window.open(`chrome://extensions/?id=${chrome.runtime.id}`, '_blank');
        }
    };

    const reloadExtension = () => {
        chrome.runtime.reload();
    };

    const isNewWay = chromeVersion >= 138;

    return (
        <div style={{
            maxWidth: '600px',
            width: '90%',
            padding: '2rem',
            backgroundColor: 'var(--surface-bg, #252526)',
            color: 'var(--text-primary, #e6e6e6)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #333)',
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
            <h1 style={{ marginBottom: '1rem', color: 'var(--accent-color, #22c55e)', fontSize: '1.8rem' }}>Setup Required</h1>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary, #999)', lineHeight: 1.6 }}>
                Shieldmonkey needs the <strong>UserScripts</strong> permission to function.
                <br />This permission is not enabled by default and must be turned on manually.
            </p>

            <div style={{
                textAlign: 'left',
                backgroundColor: 'rgba(0,0,0,0.2)',
                padding: '1.5rem',
                borderRadius: '8px',
                marginBottom: '2rem',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))'
            }}>
                {isNewWay ? (
                    <>
                        <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary, #e6e6e6)', fontWeight: 600 }}>
                            For Chrome 138+:
                        </p>
                        <ol style={{ paddingLeft: '1.5rem', margin: 0, color: 'var(--text-primary, #e6e6e6)' }}>
                            <li style={{ marginBottom: '0.75rem' }}>Click <strong>Open Extension Settings</strong> below.</li>
                            <li>Enable the <strong>Allow User Scripts</strong> toggle.</li>
                        </ol>
                    </>
                ) : (
                    <>
                        <p style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary, #e6e6e6)', fontWeight: 600 }}>
                            Instruction:
                        </p>
                        <ol style={{ paddingLeft: '1.5rem', margin: 0, color: 'var(--text-primary, #e6e6e6)' }}>
                            <li style={{ marginBottom: '0.75rem' }}>Click <strong>Open Extension Settings</strong> below.</li>
                            {chromeVersion > 0 && chromeVersion < 120 ? (
                                <li style={{ color: '#ff6b6b' }}>Warning: Your Chrome version ({chromeVersion}) is too old. Extensions requires Chrome 120+.</li>
                            ) : (
                                <li>Enable <strong>Developer mode</strong> (top right corner of the extensions page).</li>
                            )}
                        </ol>
                        <p style={{ fontSize: '0.9em', marginTop: '1rem', color: 'var(--text-secondary, #999)' }}>
                            <em>Note: On newer Chrome versions (138+), look for "Allow User Scripts" toggle instead.</em>
                        </p>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn-secondary" onClick={openExtensionsPage} style={{ padding: '0.8rem 1.5rem' }}>
                    Open Extension Settings
                </button>
                <button className="btn-primary" onClick={reloadExtension} style={{ padding: '0.8rem 1.5rem' }}>
                    I've Enabled It
                </button>
            </div>
        </div>
    );
};

export default PermissionHelp;
