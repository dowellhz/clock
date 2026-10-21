(() => {
  const menus = [...document.querySelectorAll('.studio-clock-menu')];
  document.addEventListener('click', event => {
    menus.forEach(menu => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    menus.forEach(menu => {
      if (menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
        event.preventDefault();
      }
    });
  });
  window.addEventListener('pageshow', () => menus.forEach(menu => { menu.open = false; }));
})();
