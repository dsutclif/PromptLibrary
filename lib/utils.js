// Utility functions for the extension

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function generateId(prefix = 'id') {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

function isElementVisible(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    computedStyle.display !== 'none' &&
    computedStyle.visibility !== 'hidden' &&
    computedStyle.opacity !== '0'
  );
}

function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

function simulateTyping(element, text) {
  // Clear existing content
  element.value = '';
  element.textContent = '';

  // Focus the element
  element.focus();

  // For contenteditable elements
  if (element.isContentEditable) {
    element.textContent = text;
    
    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Set cursor to end
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // For input/textarea elements
    element.value = text;
    
    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    // Set cursor to end
    element.setSelectionRange(text.length, text.length);
  }
}

function showToast(message, type = 'info', duration = 3000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `prompt-library-toast prompt-library-toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✗' : 'ℹ'}
    </div>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .prompt-library-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      animation: slideIn 0.3s ease-out;
    }
    
    .prompt-library-toast-success {
      background: rgba(34, 197, 94, 0.9);
      color: white;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    
    .prompt-library-toast-warning {
      background: rgba(251, 191, 36, 0.9);
      color: white;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }
    
    .prompt-library-toast-error {
      background: rgba(239, 68, 68, 0.9);
      color: white;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .prompt-library-toast-info {
      background: rgba(59, 130, 246, 0.9);
      color: white;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    
    .toast-icon {
      margin-right: 8px;
      font-weight: bold;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 300);
  }, duration);
}
