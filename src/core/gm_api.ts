export const GM_API_SCRIPT = `
(function(scope) {
  const GM_info = {
    script: {
      version: '1.0', // Placeholder
      name: 'Script', // Placeholder
      // TODO: Populate with real metadata
    },
    scriptHandler: 'StickyMonkey',
    version: '0.1.0'
  };

  // Helper to send messages to background
  function sendRequest(type, data) {
    return new Promise((resolve, reject) => {
        // chrome.runtime.sendMessage is available in USER_SCRIPT world if messaging is configured?
        // Wait, in MV3 userScripts world, we might not have direct access to chrome.runtime.
        // We might need to listen to custom events or use the provided API correctly.
        
        // Actually, with configureWorld({ messaging: true }), chrome.runtime.sendMessage 
        // SHOULD be available to communicate with the extension background.
        
        try {
            chrome.runtime.sendMessage({ type, data }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.error) {
                    reject(response.error);
                } else {
                    resolve(response && response.result);
                }
            });
        } catch(e) {
            console.error("StickyMonkey API Error:", e);
            reject(e);
        }
    });
  }

  const GM = {
    info: GM_info,
    
    setValue: async function(key, value) {
      return sendRequest('GM_setValue', { key, value });
    },
    
    getValue: async function(key, defaultValue) {
      const result = await sendRequest('GM_getValue', { key });
      return result !== undefined ? result : defaultValue;
    },
    
    deleteValue: async function(key) {
      return sendRequest('GM_deleteValue', { key });
    },
    
    listValues: async function() {
      return sendRequest('GM_listValues', {});
    },

    xmlhttpRequest: function(details) {
       // unique ID for this request
       const id = Math.random().toString(36).substr(2, 9);
       
       const onAbort = () => sendRequest('GM_xhrAbort', { id });
       
       sendRequest('GM_xmlhttpRequest', { id, details }).then(response => {
           // Handle immediate response if any? 
           // Real XHR needs to handle callbacks (onload, onerror etc)
           // This requires a persistent connection/listener for progress events.
           // For now, this is a stub.
           if(details.onload) details.onload({ responseText: "Not implemented fully" });
       });

       return { abort: onAbort };
    },
    
    openInTab: function(url, options) {
       sendRequest('GM_openInTab', { url, options });
    },
    
    setClipboard: function(data, info) {
       sendRequest('GM_setClipboard', { data, info });
    },
    
    notification: function(text, title, image, onclick) {
        let options = text;
        if (typeof text === 'string') {
            options = { text, title, image, onclick };
        }
        sendRequest('GM_notification', options);
    },
    
    log: function(message) {
        console.log("GM_log:", message);
    },

    addStyle: function(css) {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.body || document.documentElement).appendChild(style);
        return style;
    },

    registerMenuCommand: function(caption, onClick) {
        // TODO: This needs to notify the extension to show in the popup
        // For now we just log it, or we could send a message to register it in a background store
        // corresponding to the current tab.
        console.log("GM_registerMenuCommand registered:", caption);
        // We'll store it locally in the scope for now or send to background
        sendRequest('GM_registerMenuCommand', { caption });
    }
  };

  // Expose GM calls to global scope
  // If @grant is 'none', we shouldn't do this, but for now we do it vaguely.
  scope.GM = GM;
  scope.GM_info = GM.info;
  scope.GM_setValue = GM.setValue;
  scope.GM_getValue = GM.getValue;
  scope.GM_deleteValue = GM.deleteValue;
  scope.GM_listValues = GM.listValues;
  scope.GM_xmlhttpRequest = GM.xmlhttpRequest;
  scope.GM_openInTab = GM.openInTab;
  scope.GM_setClipboard = GM.setClipboard;
  scope.GM_notification = GM.notification;
  scope.GM_log = GM.log;
  scope.GM_addStyle = GM.addStyle;
  scope.GM_registerMenuCommand = GM.registerMenuCommand;
  
  // unsafeWindow handling (approximation)
  scope.unsafeWindow = window; 

})(window);
`;
