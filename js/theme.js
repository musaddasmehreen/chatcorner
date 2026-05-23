// Applies saved theme immediately (before paint to avoid flash)
(function() {
  const saved = localStorage.getItem('cc_theme') || 'nebula';
  document.documentElement.setAttribute('data-theme', saved);
})();

function setTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('cc_theme', name);
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.theme === name);
  });
}

// Re-apply active class after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('cc_theme') || 'nebula';
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.theme === saved);
  });
});
