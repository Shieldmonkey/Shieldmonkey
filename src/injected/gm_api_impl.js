(function(scope) {
  const SCRIPT_NAME = "__SCRIPT_NAME__";
  const SCRIPT_ID = "__SCRIPT_ID__";
  // These placeholders will be replaced with JSON strings by the generator
  const PERMISSIONS_JSON = '__GRANTED_PERMISSIONS__'; 
  const SCRIPT_INFO_JSON = '__SCRIPT_OBJ__';

  console.log("Shieldmonkey: Injecting API for " + SCRIPT_NAME);
  try {
    const permissions = JSON.parse(PERMISSIONS_JSON);
    const granted = new Set(permissions);
    
    // Parse script info
    const scriptInfo = JSON.parse(SCRIPT_INFO_JSON);
  
    const GM_info = {
      script: scriptInfo,
      scriptHandler: 'Shieldmonkey',
      version: '0.1.0'
    };

    // --- Storage Sync Implementation ---
    // We use localStorage as a synchronous read-through cache for the USER_SCRIPT world.
    // Key prefix: sm_cache_<SCRIPT_ID>_
    const CACHE_PREFIX = `sm_cache_${SCRIPT_ID}_`;

    function getCacheKey(key) {
        return CACHE_PREFIX + key;
    }

    // Storage Change Listeners
    const changeListeners = new Map();
    let listenerCounter = 0;

    function notifyListeners(key, oldValue, newValue, remote) {
        for (const [id, listener] of changeListeners) {
            try {
                // Filter by key if listener was registered for specific key (though GM usually registers globally per script? No, GM_addValueChangeListener is for specific key)
                // Wait, GM_addValueChangeListener(name, callback)
                if (listener.key === key) {
                    listener.callback(key, oldValue, newValue, remote);
                }
            } catch (e) {
                console.error("Error in storage listener:", e);
            }
        }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'GM_STORAGE_CHANGE' && message.scriptId === SCRIPT_ID) {
                const key = message.key;
                const newValue = message.value;
                const cacheKey = getCacheKey(key);
                const oldValue = localStorage.getItem(cacheKey); // might be stringified or raw? 
                
                // Update cache
                if (newValue === undefined) {
                     localStorage.removeItem(cacheKey);
                } else {
                     // We store stringified value in localStorage to match what we might expect? 
                     // Actually GM_setValue stores JSON-able types. 
                     // localStorage stores strings.
                     // Let's store JSON stringified in localStorage to be safe.
                     localStorage.setItem(cacheKey, JSON.stringify(newValue));
                }

                notifyListeners(key, oldValue ? JSON.parse(oldValue) : undefined, newValue, message.remote);
            } else if (message.type === 'GM_URL_CHANGE') {
                checkUrlChange();
            }
        });
    }
    function sendRequest(type, data) {
      return new Promise((resolve, reject) => {
          try {
              const scriptId = SCRIPT_ID;
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
              console.error("Shieldmonkey API Error:", e);
              reject(e);
          }
      });
    }

    const GM = {
      info: GM_info,
      
      setValue: async function(key, value) {
        if (!granted.has('GM_setValue') && !granted.has('GM.setValue')) {
            console.warn("Shieldmonkey: GM_setValue permission not granted");
            return;
        }
        
        // Update local cache synchronously
        const cacheKey = getCacheKey(key);
        const oldValueStr = localStorage.getItem(cacheKey);
        const oldValue = oldValueStr ? JSON.parse(oldValueStr) : undefined;
        
        localStorage.setItem(cacheKey, JSON.stringify(value));
        
        // Notify local listeners immediately (remote=false)
        notifyListeners(key, oldValue, value, false);

        return sendRequest('GM_setValue', { key, value });
      },
      
      getValue: function(key, defaultValue) {
        if (!granted.has('GM_getValue') && !granted.has('GM.getValue')) {
           return defaultValue;
        }
        
        // Sync Read from Cache
        const cacheKey = getCacheKey(key);
        const cached = localStorage.getItem(cacheKey);
        
        if (cached !== null) {
            try {
                return JSON.parse(cached);
            } catch(e) {
                return defaultValue;
            }
        }
        
        // Cache miss: return default. 
        // We could try to fetch async in background to populate cache for next time, but for now strict sync return.
        // Ideally we should have pre-loaded storage on script injection, but that's complex.
        // For consistent behavior, if we miss, we assume it doesn't exist or not loaded.
        return defaultValue;
      },
      
      deleteValue: async function(key) {
        if (!granted.has('GM_deleteValue')) return;
        
        const cacheKey = getCacheKey(key);
        const oldValueStr = localStorage.getItem(cacheKey);
        const oldValue = oldValueStr ? JSON.parse(oldValueStr) : undefined;
        
        localStorage.removeItem(cacheKey);
        
        notifyListeners(key, oldValue, undefined, false);

        return sendRequest('GM_deleteValue', { key });
      },
      
      listValues: function() {
        if (!granted.has('GM_listValues')) return [];
        // List from local cache
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(CACHE_PREFIX)) {
                keys.push(k.slice(CACHE_PREFIX.length));
            }
        }
        return keys;
      },
      
      addValueChangeListener: function(name, callback) {
          if (!granted.has('GM_addValueChangeListener')) return;
          const id = ++listenerCounter;
          changeListeners.set(id, { key: name, callback });
          return id;
      },
      
      removeValueChangeListener: function(listenerId) {
          if (!granted.has('GM_removeValueChangeListener') && !granted.has('GM_addValueChangeListener')) return;
          changeListeners.delete(listenerId);
      },

      xmlhttpRequest: function(details) {
         // EXPLICITLY NOT SUPPORTED
         console.error("Shieldmonkey: GM_xmlhttpRequest is not supported.");
         if(details.onerror) details.onerror({ error: "Not supported" });
         return { abort: () => {} };
      },
      
      openInTab: function(url, options) {
         if (!granted.has('GM_openInTab') && !granted.has('GM.openInTab')) {
           console.warn("Shieldmonkey: GM_openInTab permission not granted");
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
      },

      closeTab: function() {
          // Check for 'window.close' permission too (common practice)
          if (!granted.has('GM_closeTab') && !granted.has('window.close') && !granted.has('close')) {
              console.warn("Shieldmonkey: GM_closeTab (or window.close) permission not granted");
              return;
          }
          sendRequest('GM_closeTab', {});
      }
    };

    // Expose GM calls to global scope
    scope.GM = GM;
    scope.GM_info = GM.info;
    
    if (granted.has('GM_setValue')) scope.GM_setValue = GM.setValue;
    if (granted.has('GM_getValue')) scope.GM_getValue = GM.getValue;
    if (granted.has('GM_deleteValue')) scope.GM_deleteValue = GM.deleteValue;
    if (granted.has('GM_listValues')) scope.GM_listValues = GM.listValues;
    if (granted.has('GM_addValueChangeListener')) scope.GM_addValueChangeListener = GM.addValueChangeListener;
    if (granted.has('GM_removeValueChangeListener') || granted.has('GM_addValueChangeListener')) scope.GM_removeValueChangeListener = GM.removeValueChangeListener;

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

    // Window overrides
    const originalClose = window.close;
    window.close = function() {
        // Try native close first (might fail if not opened by script)
        try {
            originalClose.call(window);
        } catch(e) {}
        
        // Then try GM_closeTab (which asks background to close tab)
        GM.closeTab();
    };

    // onurlchange implementation
    // We can't easily detect pushState/replaceState without patching them
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    function checkUrlChange() {
        if (typeof window.onurlchange === 'function') {
            window.onurlchange(window.location.href);
        }
    }

    // Listen for background notifications (reliable for history.pushState from main world)
    // Handled above in GM_STORAGE_CHANGE listener block to avoid duplicate listeners


    history.pushState = function(...args) {
        const res = originalPushState.apply(history, args);
        checkUrlChange();
        return res;
    };
    
    history.replaceState = function(...args) {
        const res = originalReplaceState.apply(history, args);
        checkUrlChange();
        return res;
    };
    
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('hashchange', checkUrlChange);
 


  } catch (e) {
    console.error("Shieldmonkey: Failed to inject API for " + SCRIPT_NAME, e);
  }
})(window);
