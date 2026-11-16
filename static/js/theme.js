const validThemes = ['light', 'dark']

function setTheme(theme) {
  if (!validThemes.includes(theme)) {
    return
  }
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme);

  document.querySelectorAll('.theme-switch button').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme))
  })
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme')
  setTheme(validThemes.includes(savedTheme) ? savedTheme : 'light')
}

loadTheme()
