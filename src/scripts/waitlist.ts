/** The /platform waiting list. Production is a static host that cannot take a
 *  form post, so the form composes the request in the visitor's mail app — see
 *  src/data/platform.ts. Without this script the form still works as a native
 *  mailto post; with it, the message reads as a letter instead of name=value. */
import { write } from './clipboard';

for (const form of document.querySelectorAll<HTMLFormElement>('[data-waitlist]')) {
  const status = form.querySelector<HTMLElement>('[data-waitlist-status]');
  const copy = form.querySelector<HTMLButtonElement>('[data-waitlist-copy]');
  const action = new URL(form.action);
  const to = action.pathname;
  const subject = action.searchParams.get('subject') ?? '';
  let message = '';

  // `submit` fires only after the browser has validated the required fields.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const lines = ['Hello LibreDB team,', '', 'I would like to join the LibreDB Platform waiting list.', ''];
    for (const [name, value] of new FormData(form)) {
      const text = String(value).trim();
      if (text) lines.push(`${name}: ${text}`);
    }
    message = lines.join('\n');
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    if (status) status.hidden = false;
  });

  copy?.addEventListener('click', async () => {
    try {
      await write(`To: ${to}\nSubject: ${subject}\n\n${message}`);
      copy.textContent = 'copied';
    } catch {
      copy.textContent = 'copy failed — select the fields above instead';
    }
  });
}
