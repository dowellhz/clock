const root = document.documentElement;
const button = document.querySelector('[data-language]');
function setLanguage(language) {
  root.lang = language === 'en' ? 'en' : 'zh-CN';
  button.textContent = root.lang === 'en' ? '中文' : 'EN';
  button.setAttribute('aria-label', root.lang === 'en' ? '切换到中文' : 'Switch to English');
  try { localStorage.setItem('plaintick-language', language); } catch (_) {}
}
let saved;
try { saved = localStorage.getItem('plaintick-language'); } catch (_) {}
setLanguage(saved || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
button.addEventListener('click', () => setLanguage(root.lang === 'en' ? 'zh' : 'en'));
