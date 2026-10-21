(() => {
  const key = 'clock-studio-language';
  const readLanguage = () => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === 'en' || saved === 'zh') return saved;
      for (const legacy of ['plaintick-language', 'dualflipclock-language']) {
        const value = localStorage.getItem(legacy);
        if (value === 'en' || value === 'zh') return value;
      }
    } catch (_) {}
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  };
  const applyLanguage = (language, persist = false) => {
    const selected = language === 'en' ? 'en' : 'zh';
    document.documentElement.lang = selected === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-zh], [data-en]').forEach(element => {
      element.hidden = !element.hasAttribute(`data-${selected}`);
    });
    for (const attribute of ['aria-label', 'alt', 'content', 'title', 'text']) {
      document.querySelectorAll(`[data-${selected}-${attribute}]`).forEach(element => {
        const value = element.getAttribute(`data-${selected}-${attribute}`);
        if (attribute === 'text') element.textContent = value;
        else element.setAttribute(attribute, value);
      });
    }
    document.querySelectorAll('[data-language]').forEach(button => {
      button.textContent = selected === 'en' ? '中文' : 'EN';
      button.setAttribute('aria-label', selected === 'en' ? '切换到中文' : 'Switch to English');
      button.lang = selected === 'en' ? 'zh-CN' : 'en';
    });
    if (persist) {
      try { localStorage.setItem(key, selected); } catch (_) {}
    }
    window.dispatchEvent(new CustomEvent('clock-language-change', { detail: { language: selected } }));
  };
  applyLanguage(readLanguage());
  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => applyLanguage(document.documentElement.lang === 'en' ? 'zh' : 'en', true));
  });
  window.addEventListener('pageshow', () => applyLanguage(readLanguage()));
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) applyLanguage(readLanguage());
  });
})();
