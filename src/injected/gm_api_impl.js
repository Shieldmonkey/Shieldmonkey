(function(scope) {
  const SCRIPT_NAME = "__SCRIPT_NAME__";
  const SCRIPT_ID = "__SCRIPT_ID__";
  const SCRIPT_TOKEN = "__SCRIPT_TOKEN__";
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
              const token = SCRIPT_TOKEN;
              chrome.runtime.sendMessage({ type, data, scriptId, token }, (response) => {
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
          // Just async request, but we need ID for unregister? 
          // Background now returns it.
          // But strict sync return in traditional GM? 
          // Usually valid impls return ID immediately or promise?
          // Tampermonkey returns id (integer/string).
          // Since we are async to background, we can't return real ID immediately if generated there unless we predict it.
          // We changed background to return predictable ID with timestamp + caption?
          // We can generate ID here and send it? No, scriptId comes from there.
          // Let's generate a placeholder or promise?
          // If we return undefined, unregister might fail.
          // But we can't block. 
          // Actually we can generate unique ID here? 
          // 'cmd_' + SCRIPT_ID + '_' + unique
          // But SCRIPT_ID is strings.
          // Let's rely on callback result? No, synchronous return expected.
          // Implementing sync return is hard with async message.
          // Stub: return a dummy object that we can map later? No.
          // Let's try to generate ID here if possible? SCRIPT_ID is constant.
          // const menuId = ...
          // sendRequest('GM_registerMenuCommand', { caption, menuId });
          // But currently bg generates it.
          // For now, return undefined and log warning about unregister limitation?
          // Actually, if we want to support unregister, we must return an ID.
          // Let's try sending the request asynchronously and hope it registers.
          // We can return a Promise? Some scripts might await it?
          // Most scripts expect number/string.
          
          return sendRequest('GM_registerMenuCommand', { caption });
      },

      closeTab: function() {
          // Check for 'window.close' permission too (common practice)
          if (!granted.has('GM_closeTab') && !granted.has('window.close') && !granted.has('close')) {
              console.warn("Shieldmonkey: GM_closeTab (or window.close) permission not granted");
              return;
          }
          sendRequest('GM_closeTab', {});
      },

      // --- Implemented APIs (previously unimplemented) ---
       download: function(details) {
            if (!granted.has('GM_download')) {
                console.error("Shieldmonkey: GM_download permission not granted");
                return;
            }
            // details can be url string or object
            let url, name;
            if (typeof details === 'string') {
                url = details;
                name = arguments[1]; // optional filename
            } else {
                url = details.url;
                name = details.name; // filename
            }
            // Returns promise that resolves to ID? GM_download typically returns { abort: function }
            // But we can return a promise wrapper or object.
            // Standard is void or task object. 
            // For now let's just trigger download.
            sendRequest('GM_download', { url, name });
            return { abort: () => {} }; 
       },

       unregisterMenuCommand: function(menuCmdId) {
            if (!granted.has('GM_unregisterMenuCommand')) return;
            sendRequest('GM_unregisterMenuCommand', { menuCmdId });
       },

       setValues: function(values) {
           if (!granted.has('GM_setValue')) return; // Usually shares permission? Or GM_setValues
           // Iterate and set cache
           const date = new Date();
           for (const key of Object.keys(values)) {
               const cacheKey = getCacheKey(key);
               const oldValueStr = localStorage.getItem(cacheKey);
               const oldValue = oldValueStr ? JSON.parse(oldValueStr) : undefined;
               
               localStorage.setItem(cacheKey, JSON.stringify(values[key]));
               notifyListeners(key, oldValue, values[key], false);
           }
           sendRequest('GM_setValues', { values });
       },

       getValues: function(keys) {
           if (!granted.has('GM_getValue')) return {};
           // Read from cache
           const result = {};
           if (Array.isArray(keys)) {
                for (const key of keys) {
                    const cacheKey = getCacheKey(key);
                    const cached = localStorage.getItem(cacheKey);
                    if (cached !== null) {
                         try { result[key] = JSON.parse(cached); } catch(e) {}
                    }
                }
           } else {
               // If object with defaults
                for (const key of Object.keys(keys)) {
                    const cacheKey = getCacheKey(key);
                    const cached = localStorage.getItem(cacheKey);
                    if (cached !== null) {
                         try { result[key] = JSON.parse(cached); } catch(e) {}
                    } else {
                        result[key] = keys[key]; // default
                    }
                }
           }
           return result;
       },

       deleteValues: function(keys) {
           if (!granted.has('GM_deleteValue')) return;
           for (const key of keys) {
               const cacheKey = getCacheKey(key);
               const oldValueStr = localStorage.getItem(cacheKey);
               const oldValue = oldValueStr ? JSON.parse(oldValueStr) : undefined;
               localStorage.removeItem(cacheKey);
               notifyListeners(key, oldValue, undefined, false);
           }
           sendRequest('GM_deleteValues', { keys });
       },

       // --- Unsupported APIs ---
       getResourceText: function() { console.error("Shieldmonkey: GM_getResourceText is not supported."); },
       getResourceURL: function() { console.error("Shieldmonkey: GM_getResourceURL is not supported."); },
       getTab: function() { console.error("Shieldmonkey: GM_getTab is not supported."); },
       saveTab: function() { console.error("Shieldmonkey: GM_saveTab is not supported."); },
       getTabs: function() { console.error("Shieldmonkey: GM_getTabs is not supported."); },
       webRequest: function() { console.error("Shieldmonkey: GM_webRequest is not supported."); },
       cookie: {
           list: function() { console.error("Shieldmonkey: GM_cookie is not supported."); },
           set: function() { console.error("Shieldmonkey: GM_cookie is not supported."); },
           delete: function() { console.error("Shieldmonkey: GM_cookie is not supported."); }
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

    if (granted.has('GM_download')) scope.GM_download = GM.download;
    if (granted.has('GM_unregisterMenuCommand')) scope.GM_unregisterMenuCommand = GM.unregisterMenuCommand;
    if (granted.has('GM_setValue')) scope.GM_setValues = GM.setValues;
    if (granted.has('GM_getValue')) scope.GM_getValues = GM.getValues;
    if (granted.has('GM_deleteValue')) scope.GM_deleteValues = GM.deleteValues;

    // Unsupported API Bindings (always exposed but warn)
    scope.GM_getResourceText = GM.getResourceText;
    scope.GM_getResourceURL = GM.getResourceURL;
    scope.GM_getTab = GM.getTab;
    scope.GM_saveTab = GM.saveTab;
    scope.GM_getTabs = GM.getTabs;
    scope.GM_webRequest = GM.webRequest;
    scope.GM_cookie = GM.cookie;

    
    // unsafeWindow handling
    // Shieldmonkey runs in USER_SCRIPT world (Isolated), so full unsafeWindow is not supported.
    // We map it to window (Isolated) but warn developers.
    Object.defineProperty(scope, 'unsafeWindow', {
        get: function() {
            console.warn("Shieldmonkey: unsafeWindow is not fully supported in Manifest V3. You are accessing the Isolated World window.");
            return window;
        },
        configurable: true
    }); 

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
    
    // window.focus override (unsupported)
    window.focus = function() {
        console.warn("Shieldmonkey: window.focus logic is not implemented/supported in background.");
        // We could forward to original but usually user scripts want to focus the tab, which is restricted.
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
