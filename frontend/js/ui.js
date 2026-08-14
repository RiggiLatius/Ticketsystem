(function (global) {
  const UI = {};

  UI.el = function (tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'dataset') {
          for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
        } else if (typeof v === 'boolean') {
          if (v) node.setAttribute(k, '');
        } else {
          node.setAttribute(k, v);
        }
      }
    }
    for (const child of children) {
      if (child == null || child === false) continue;
      if (Array.isArray(child)) {
        for (const c of child) if (c != null) node.append(c.nodeType ? c : String(c));
      } else if (child.nodeType) node.append(child);
      else node.append(String(child));
    }
    return node;
  };

  UI.clear = function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  };

  UI.mount = function (node) {
    const app = document.getElementById('app');
    UI.clear(app);
    app.append(node);
  };

  UI.toast = function (message, variant) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = UI.el('div', { class: `toast toast--${variant || 'info'}`, text: message });
    container.append(t);
    setTimeout(() => {
      t.style.transition = 'opacity 0.2s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 200);
    }, 4000);
  };

  UI.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  UI.formatDate = function (isoOrSql) {
    if (!isoOrSql) return '';
    const s = String(isoOrSql).replace(' ', 'T');
    const iso = /Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(isoOrSql);
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  global.UI = UI;
})(window);
