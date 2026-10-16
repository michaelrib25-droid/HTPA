// Appended to <body>, not #app — app.js's render() wipes #app's contents on
// every tab switch, which would kill a toast mid-fade before it was seen.
let activeToast = null;

export function showToast(message) {
  if (activeToast) activeToast.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  activeToast = toast;
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => {
      toast.remove();
      if (activeToast === toast) activeToast = null;
    }, 200);
  }, 1500);
}
