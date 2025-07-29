/**
 * Runtime Devtools Blocker Script
 * 
 * This script intercepts and blocks Next.js devtools chunk loading
 * at the earliest possible stage to prevent errors
 */

(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Block script tag creation for devtools chunks
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName) {
    const element = originalCreateElement.call(this, tagName);
    
    if (tagName.toLowerCase() === 'script') {
      // Override src setter to block devtools chunks
      const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src').set;
      Object.defineProperty(element, 'src', {
        set: function(value) {
          if (typeof value === 'string' && value.includes('next-devtools')) {
            // Block devtools script loading by setting empty src
            return;
          }
          return originalSrcSetter.call(this, value);
        },
        get: function() {
          return this._src || '';
        }
      });
    }
    
    return element;
  };
  
  // Block dynamic imports of devtools modules
  if (window.__webpack_require__) {
    const originalRequire = window.__webpack_require__;
    window.__webpack_require__ = function(moduleId) {
      if (typeof moduleId === 'string' && moduleId.includes('next-devtools')) {
        // Return empty module for devtools
        return {};
      }
      return originalRequire.apply(this, arguments);
    };
  }
  
  // Block fetch requests for devtools chunks
  if (window.fetch) {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input.url || '';
      if (url.includes('next-devtools') || url.includes('devtools_index')) {
        // Return empty successful response
        return Promise.resolve(new Response('// Devtools blocked', {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/javascript' }
        }));
      }
      return originalFetch.call(this, input, init);
    };
  }
  
  // Block XMLHttpRequest for devtools chunks
  if (window.XMLHttpRequest) {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      if (typeof url === 'string' && (url.includes('next-devtools') || url.includes('devtools_index'))) {
        // Block the request by opening a dummy URL
        return originalXHROpen.call(this, method, 'data:text/javascript,', async, user, password);
      }
      return originalXHROpen.call(this, method, url, async, user, password);
    };
  }
  
  // Suppress devtools-related console errors
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('next-devtools') || 
        message.includes('devtools_index') ||
        message.includes('_next/static/chunks/node_modules_next_dist_compiled_next-devtools')) {
      // Silently ignore devtools errors
      return;
    }
    return originalConsoleError.apply(this, args);
  };
  
  console.log('[DevtoolsBlocker] Next.js devtools blocking initialized');
})();