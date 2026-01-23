

export interface GM_ScriptConfig {
  id: string;
  name: string;
  version: string;
  permissions: string[];
  namespace?: string;
  description?: string;
}

export function getGMAPIScript(config: GM_ScriptConfig): string {
  // Convert permissions array to a set for easier lookup in the injected script
  const perms = JSON.stringify(config.permissions || []);
  const scriptObj = JSON.stringify({
    version: config.version || '1.0',
    name: config.name || 'Unknown Script',
    namespace: config.namespace || '',
    description: config.description || '',
    // Add other properties as needed
  });

  return `
(function(scope) {
  const granted = new Set(${perms});
  const GM_SCRIPT_ID = "${config.id}";
  
  const GM_info = {
    script: ${scriptObj},
    scriptHandler: 'StaticMonkey',
    version: '0.1.0'
  };

  // Helper to send messages to background
  function sendRequest(type, data) {
    return new Promise((resolve, reject) => {
        try {
            const scriptId = GM_SCRIPT_ID;
            chrome.runtime.sendMessage({ type, data, scriptId }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (response && response.error) {
                    reject(response.error);
                } else {
                    resolve(response && response.result);
                }
            });
        } catch(e) {
            console.error("StaticMonkey API Error:", e);
            reject(e);
        }
    });
  }

  const GM = {
    info: GM_info,
    
    setValue: async function(key, value) {
      if (!granted.has('GM_setValue') && !granted.has('GM.setValue')) {
          console.warn("StaticMonkey: GM_setValue permission not granted");
          return;
      }
      return sendRequest('GM_setValue', { key, value });
    },
    
    getValue: async function(key, defaultValue) {
      if (!granted.has('GM_getValue') && !granted.has('GM.getValue')) {
         // Some scripts might expect this to work without explicit grant in some managers, but strict is better.
         // fallback to default
         return defaultValue;
      }
      const result = await sendRequest('GM_getValue', { key });
      return result !== undefined ? result : defaultValue;
    },
    
    deleteValue: async function(key) {
      if (!granted.has('GM_deleteValue')) return;
      return sendRequest('GM_deleteValue', { key });
    },
    
    listValues: async function() {
      if (!granted.has('GM_listValues')) return [];
      return sendRequest('GM_listValues', {});
    },

    xmlhttpRequest: function(details) {
       if (!granted.has('GM_xmlhttpRequest') && !granted.has('GM.xmlhttpRequest')) {
          console.error("StaticMonkey: GM_xmlhttpRequest permission not granted");
          if(details.onerror) details.onerror({ error: "Permission denied" });
          return { abort: () => {} };
       }
       
       // unique ID for this request
       const id = Math.random().toString(36).substr(2, 9);
       
       const onAbort = () => sendRequest('GM_xhrAbort', { id });
       
       sendRequest('GM_xmlhttpRequest', { id, details }).then(response => {
           if (response && details.onload) {
               details.onload(response);
           }
       }).catch(err => {
           if (details.onerror) details.onerror({ error: err });
       });

       return { abort: onAbort };
    },
    
    openInTab: function(url, options) {
       if (!granted.has('GM_openInTab') && !granted.has('GM.openInTab')) {
         console.warn("StaticMonkey: GM_openInTab permission not granted");
         return;
       }
       sendRequest('GM_openInTab', { url, options });
    },
    
    setClipboard: function(data, info) {
       if (!granted.has('GM_setClipboard') && !granted.has('GM.setClipboard')) return;
       // Try local clipboard API first
       if (navigator.clipboard && navigator.clipboard.writeText) {
           navigator.clipboard.writeText(data).catch(err => {
               console.error("GM_setClipboard failed:", err);
           });
       } else {
           console.warn("GM_setClipboard: navigator.clipboard not available");
       }
    },
    
    notification: function(text, title, image, onclick) {
        if (!granted.has('GM_notification') && !granted.has('GM.notification')) return;
        
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
    
    addElement: function(parentOrTag, tagOrAttrs, attributes) {
        let parent, tag, attrs;
        if (typeof parentOrTag === 'string') {
            tag = parentOrTag;
            attrs = tagOrAttrs;
            parent = document.body || document.documentElement;
        } else {
            parent = parentOrTag;
            tag = tagOrAttrs;
            attrs = attributes;
        }
        
        const el = document.createElement(tag);
        if (attrs) {
            for (const key of Object.keys(attrs)) {
                if (key === 'textContent') el.textContent = attrs[key];
                else if (key === 'innerHTML') el.innerHTML = attrs[key];
                else el.setAttribute(key, attrs[key]);
            }
        }
        if (parent) parent.appendChild(el);
        return el;
    },

    registerMenuCommand: function(caption, onClick) {
        if (!granted.has('GM_registerMenuCommand') && !granted.has('GM.registerMenuCommand')) return;
        console.log("GM_registerMenuCommand registered:", caption);
        sendRequest('GM_registerMenuCommand', { caption });
    }
  };

  // Expose GM calls to global scope
  scope.GM = GM;
  scope.GM_info = GM.info;
  
  if (granted.has('GM_setValue')) scope.GM_setValue = GM.setValue;
  if (granted.has('GM_getValue')) scope.GM_getValue = GM.getValue;
  if (granted.has('GM_deleteValue')) scope.GM_deleteValue = GM.deleteValue;
  if (granted.has('GM_listValues')) scope.GM_listValues = GM.listValues;
  if (granted.has('GM_xmlhttpRequest')) scope.GM_xmlhttpRequest = GM.xmlhttpRequest;
  if (granted.has('GM_openInTab')) scope.GM_openInTab = GM.openInTab;
  if (granted.has('GM_setClipboard')) scope.GM_setClipboard = GM.setClipboard;
  if (granted.has('GM_notification')) scope.GM_notification = GM.notification;
  scope.GM_log = GM.log;
  scope.GM_addStyle = GM.addStyle;
  scope.GM_addElement = GM.addElement;
  if (granted.has('GM_registerMenuCommand')) scope.GM_registerMenuCommand = GM.registerMenuCommand;
  
  // unsafeWindow handling
  scope.unsafeWindow = window; 

})(window);
`;
}

// Deprecated: for backward comp only if needed, but we should remove it
export const GM_API_SCRIPT = getGMAPIScript({ id: '', name: '', version: '', permissions: [] });


