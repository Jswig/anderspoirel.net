function setTheme(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
  document.querySelectorAll('.theme-switch button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  });

  try {
    localStorage.setItem('theme', theme);
  } catch (_) { }
}

let savedTheme;

try {
    savedTheme = localStorage.getItem('theme');
} catch (_) { }

setTheme(savedTheme === "light" ? "light" : "dark");
