// Applies the saved light/dark theme before the app loads (external file so the CSP needs no inline scripts).
try {
  var th = localStorage.getItem('giwa.theme');
  if (!th) th = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = th;
} catch (e) {}
