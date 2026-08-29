/**
 * One switcher drives every "pick one of N, show its panel" surface on the page:
 * the why-diagram cycler, the flow toggle, the deploy tabs, the demo tabs and
 * the engines grid. All panels are rendered server-side and toggled with
 * [hidden], so a reader without JS still gets the first panel's full content.
 *
 * Markup contract:
 *   <div data-switch="deploy" data-switch-autoplay="2600" data-switch-pin="9000"
 *        data-switch-role="tab">
 *     <button data-switch-trigger="docker">…</button>
 *     <div data-switch-panel="docker">…</div>
 *   </div>
 *
 * Accessibility
 *  - role="tab"   → full ARIA tabs, arrow/Home/End roving focus.
 *  - role="radio" → the why rows and the flow toggle, which select a state
 *                   rather than a view.
 *  - Autoplay is a WCAG 2.2.2 concern, so it never runs under
 *    prefers-reduced-motion, and it pauses while the pointer is over the group
 *    or focus is inside it — that hover/focus pause is the stop mechanism.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

class Switcher {
  private root: HTMLElement;
  private triggers: HTMLElement[];
  private panels: HTMLElement[];
  private values: string[];
  private role: string;
  private autoplayMs: number;
  private pinMs: number;

  private timer?: number;
  private pinTimer?: number;
  private hovered = false;
  private focused = false;
  private visible = true;
  private pinned = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.triggers = Array.from(root.querySelectorAll<HTMLElement>('[data-switch-trigger]'));
    this.panels = Array.from(root.querySelectorAll<HTMLElement>('[data-switch-panel]'));
    this.values = this.triggers.map((t) => t.dataset.switchTrigger ?? '');
    this.role = root.dataset.switchRole ?? 'tab';
    this.autoplayMs = Number(root.dataset.switchAutoplay ?? 0);
    this.pinMs = Number(root.dataset.switchPin ?? 0);

    this.wireAria();
    this.wireEvents();
    this.select(root.dataset.switchActive ?? this.values[0] ?? '', false);
    this.startAutoplay();
  }

  private wireAria(): void {
    if (this.role === 'tab') {
      const list = this.triggers[0]?.parentElement;
      if (list && !list.getAttribute('role')) list.setAttribute('role', 'tablist');
      this.triggers.forEach((t, i) => {
        t.setAttribute('role', 'tab');
        t.id ||= `${this.root.dataset.switch}-tab-${this.values[i]}`;
        const panel = this.panelFor(this.values[i]!);
        if (panel) {
          panel.setAttribute('role', 'tabpanel');
          panel.id ||= `${this.root.dataset.switch}-panel-${this.values[i]}`;
          panel.setAttribute('aria-labelledby', t.id);
          panel.tabIndex = 0;
          t.setAttribute('aria-controls', panel.id);
        }
      });
    } else {
      const list = this.triggers[0]?.parentElement;
      if (list && !list.getAttribute('role')) list.setAttribute('role', 'radiogroup');
      this.triggers.forEach((t) => t.setAttribute('role', 'radio'));
    }
  }

  private panelFor(value: string): HTMLElement | undefined {
    return this.panels.find((p) => p.dataset.switchPanel === value);
  }

  private wireEvents(): void {
    this.triggers.forEach((t, i) => {
      t.addEventListener('click', () => {
        this.select(this.values[i]!, true);
        this.pin();
      });
      t.addEventListener('keydown', (e) => this.onKey(e as KeyboardEvent, i));
    });

    this.root.addEventListener('pointerenter', () => {
      this.hovered = true;
      this.stopAutoplay();
    });
    this.root.addEventListener('pointerleave', () => {
      this.hovered = false;
      this.startAutoplay();
    });
    this.root.addEventListener('focusin', () => {
      this.focused = true;
      this.stopAutoplay();
    });
    this.root.addEventListener('focusout', (e) => {
      if (this.root.contains(e.relatedTarget as Node)) return;
      this.focused = false;
      this.startAutoplay();
    });

    // another module can ask for a panel (the SQL replay button jumps to the editor tab)
    this.root.addEventListener('switch:request', (e) => {
      const value = (e as CustomEvent<{ value: string }>).detail?.value;
      if (value) {
        this.select(value, true);
        this.pin();
      }
    });

    if ('IntersectionObserver' in window && this.autoplayMs > 0) {
      const io = new IntersectionObserver(
        ([entry]) => {
          this.visible = entry?.isIntersecting ?? true;
          if (this.visible) this.startAutoplay();
          else this.stopAutoplay();
        },
        { threshold: 0.15 },
      );
      io.observe(this.root);
    }
  }

  private onKey(e: KeyboardEvent, index: number): void {
    const last = this.triggers.length - 1;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next < 0) return;
    e.preventDefault();
    this.select(this.values[next]!, true);
    this.triggers[next]!.focus();
    this.pin();
  }

  select(value: string, userInitiated: boolean): void {
    if (!this.values.includes(value)) return;
    this.root.dataset.switchActive = value;

    this.triggers.forEach((t, i) => {
      const on = this.values[i] === value;
      t.dataset.state = on ? 'active' : 'idle';
      if (this.role === 'tab') {
        t.setAttribute('aria-selected', String(on));
      } else {
        t.setAttribute('aria-checked', String(on));
      }
      // roving tabindex — one stop for the whole group, arrows move within it
      t.tabIndex = on ? 0 : -1;
    });

    for (const p of this.panels) p.hidden = p.dataset.switchPanel !== value;

    this.root.dispatchEvent(new CustomEvent('switch:change', { detail: { value, userInitiated }, bubbles: true }));
  }

  private pin(): void {
    if (this.pinMs <= 0) return;
    this.pinned = true;
    this.stopAutoplay();
    window.clearTimeout(this.pinTimer);
    this.pinTimer = window.setTimeout(() => {
      this.pinned = false;
      this.startAutoplay();
    }, this.pinMs);
  }

  private startAutoplay(): void {
    if (this.autoplayMs <= 0 || reduceMotion.matches) return;
    if (this.pinned || this.hovered || this.focused || !this.visible) return;
    this.stopAutoplay();
    this.timer = window.setInterval(() => {
      const i = this.values.indexOf(this.root.dataset.switchActive ?? '');
      this.select(this.values[(i + 1) % this.values.length]!, false);
    }, this.autoplayMs);
  }

  private stopAutoplay(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }
}

for (const root of document.querySelectorAll<HTMLElement>('[data-switch]')) {
  new Switcher(root);
}

export {};
