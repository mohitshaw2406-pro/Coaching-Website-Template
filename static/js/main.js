// ── DARK MODE ──
const html = document.documentElement;
const saved = localStorage.getItem('theme');
if (saved) {
    html.setAttribute('data-theme', saved);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    html.setAttribute('data-theme', 'dark');
}

function toggleTheme() {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateToggleBtn();
}

function updateToggleBtn() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const isDark = html.getAttribute('data-theme') === 'dark';
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}

document.addEventListener('DOMContentLoaded', updateToggleBtn);