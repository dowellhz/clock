const root = document.documentElement;
const languageButton = document.querySelector('[data-language]');

function setLanguage(language) {
  const isEnglish = language === 'en';
  root.lang = isEnglish ? 'en' : 'zh-CN';
  if (languageButton) {
    languageButton.textContent = isEnglish ? '中文' : 'EN';
    languageButton.setAttribute('aria-label', isEnglish ? '切换到中文' : 'Switch to English');
  }
  localStorage.setItem('dualflipclock-language', isEnglish ? 'en' : 'zh');
}

const savedLanguage = localStorage.getItem('dualflipclock-language');
const initialLanguage = savedLanguage || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
setLanguage(initialLanguage);

if (languageButton) {
  languageButton.addEventListener('click', () => setLanguage(root.lang === 'en' ? 'zh' : 'en'));
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
