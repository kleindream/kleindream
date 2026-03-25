/* KleinDream UI Enhancements (no deps)
   - Page fade transitions
   - Loader overlay on form submits
   - Theme switcher (Classic / Night / Silver)
   - Lightweight toast helper
*/
(function () {
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Fade-in
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('kd-ready');

    // Apply saved theme
    const saved = localStorage.getItem('kdTheme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    // Tiny toast from querystring
    const params = new URLSearchParams(location.search);
    const ok = params.get('ok');
    const err = params.get('err');
    if (ok) toast(decodeURIComponent(ok), 'ok');
    if (err) toast(decodeURIComponent(err), 'err');
  });

  // Theme toggle
  const themes = ['classic', 'night', 'silver'];
  function cycleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'classic';
    const idx = themes.indexOf(cur);
    const next = themes[(idx + 1) % themes.length];
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('kdTheme', next);
    toast('Tema: ' + (next === 'classic' ? 'Clássico' : next === 'night' ? 'Noite' : 'Prata'), 'info');
  }
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#kdThemeToggle');
    if (btn) {
      e.preventDefault();
      cycleTheme();
    }
  });

  // Loader overlay
  const loader = () => document.getElementById('kdLoader');
  let loaderShown = false;

  function showLoader(msg) {
    const el = loader();
    if (!el) return;
    const t = el.querySelector('.kd-loader-text');
    if (t && msg) t.textContent = msg;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    loaderShown = true;
  }
  function hideLoader() {
    const el = loader();
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    loaderShown = false;
  }
  // If bfcache restores, ensure loader hidden
  window.addEventListener('pageshow', () => hideLoader());

  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form || form.hasAttribute('data-no-loader')) return;
    // Avoid double overlay on very small interactions
    const msg = form.getAttribute('data-loader-text') || 'Conectando…';
    showLoader(msg);
  });

  // Page transitions (links)
  document.addEventListener('click', (e) => {
    if (prefersReduced) return;
    const a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    if (a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.target && a.target !== '_self') return;

    // Same-origin only
    let url;
    try { url = new URL(href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;

    // Don't intercept POST-trigger links
    if (a.closest('form')) return;

    e.preventDefault();
    if (!document.body.classList.contains('kd-ready')) document.body.classList.add('kd-ready');
    document.body.classList.add('kd-leave');

    // If we already showed loader, don't stack
    if (!loaderShown) {
      // Only show loader for heavier pages
      if (href.includes('/groups') || href.includes('/messages') || href.includes('/notifications')) {
        showLoader('Carregando…');
      }
    }

    setTimeout(() => {
      location.href = url.toString();
    }, 140);
  });

  // Toasts
  function toast(message, type) {
    const host = document.getElementById('kdToasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'kd-toast ' + (type || 'info');
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  // Expose for inline scripts if needed
  window.KD = window.KD || {};
  window.KD.toast = toast;
  window.kdToast = toast;
  // Mobile nav
  function syncMobileNav() {
    const btn = document.getElementById('kdNavToggle');
    const nav = document.getElementById('kdPrimaryNav');
    if (!btn || !nav) return;
    if (window.innerWidth > 760) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('#kdNavToggle') : null;
    if (btn) {
      const nav = document.getElementById('kdPrimaryNav');
      if (!nav) return;
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    const nav = document.getElementById('kdPrimaryNav');
    const toggle = document.getElementById('kdNavToggle');
    if (!nav || !toggle || window.innerWidth > 760) return;
    const clickedInside = e.target && (e.target.closest('#kdPrimaryNav') || e.target.closest('#kdNavToggle'));
    if (!clickedInside && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  window.addEventListener('resize', syncMobileNav);
  document.addEventListener('DOMContentLoaded', syncMobileNav);

})();
