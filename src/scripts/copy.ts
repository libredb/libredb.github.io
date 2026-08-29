/** Copy-to-clipboard buttons: writes [data-copy], then shows "copied" for 1.6s
 *  (the prototype's timing). Falls back to a hidden textarea + execCommand so it
 *  still works on http:// origins where the async clipboard API is unavailable. */
function write(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand('copy')) resolve();
      else reject(new Error('copy rejected'));
    } catch (err) {
      reject(err);
    } finally {
      ta.remove();
    }
  });
}

for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  const idle = btn.textContent ?? 'copy';
  const idleLabel = btn.getAttribute('aria-label') ?? idle;
  let timer: number | undefined;

  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy ?? '';
    try {
      await write(text);
      btn.textContent = 'copied';
      btn.setAttribute('aria-label', 'Copied to clipboard');
    } catch {
      btn.textContent = 'press ⌘C';
      btn.setAttribute('aria-label', 'Copy failed — select the command and press Command C');
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      btn.textContent = idle;
      btn.setAttribute('aria-label', idleLabel);
    }, 1600);
  });
}

export {};
