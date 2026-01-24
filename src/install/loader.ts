const params = new URLSearchParams(window.location.search);
const targetUrl = params.get('target');
const installPageUrl = chrome.runtime.getURL('src/install/index.html');

if (targetUrl) {
    // Use background fetching to bypass CSP and CORS issues relative to this page
    chrome.runtime.sendMessage({ type: 'FETCH_SCRIPT_CONTENT', url: targetUrl })
        .then(response => {
            if (response && response.success) {
                // Pass content using window.name (standard technique for cross-page data passing without URL limits)
                window.name = JSON.stringify({
                    type: 'SHIELDMONKEY_INSTALL_DATA',
                    url: targetUrl,
                    source: response.text
                });
                window.location.href = installPageUrl;
            } else {
                document.body.innerHTML = `<div style="color: #ef4444; padding: 20px;">
          <h3>Error fetching script</h3>
          <p>${response?.error || 'Unknown error'}</p>
          <pre>${targetUrl}</pre>
        </div>`;
            }
        })
        .catch(err => {
            document.body.innerHTML = `<div style="color: #ef4444; padding: 20px;">
        <h3>Communication Error</h3>
        <p>${err.message}</p>
      </div>`;
        });
} else {
    document.body.innerHTML = '<div style="color: #ef4444; padding: 20px;">No target URL specified</div>';
}
