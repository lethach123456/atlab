// Shared navigation behavior for every AT Dental page.
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#links');
if (menuButton && navigation) {
  const setOpen = (open) => {
    navigation.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', () => setOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', (event) => { if (!event.target.closest('.nav')) setOpen(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menuButton.focus();
    }
  });
  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  window.matchMedia('(min-width: 1021px)').addEventListener('change', (event) => { if (event.matches) setOpen(false); });
}
