/*
 * The responsive audit's rules — the single source, evaluated in the page by whichever driver is
 * running them.
 *
 * `public/probe-mobile.html` carries the same block inline, because it audits the Astro reference
 * build from inside a browser tab with no build step to inject anything. `scripts/ghost/audit.mjs`
 * reads THIS file, evaluates it against the Ghost theme, and refuses to run if the probe's copy has
 * drifted from it — so the duplication cannot go quiet.
 *
 * WHAT THE AUDIT IS BLIND TO: it catches overflow, not cramping. A layout can pass every check here
 * and still be unreadable.
 *
 * Two rules in an earlier version were dead and looked alive, which is why `lineCount` exists:
 * `getClientRects().length` returns one rect per line box only for INLINE elements, so on a
 * block-level <p> or <h2> it is always 1, and anything gated on it never fires.
 */
const NAV = 1200;

// an element clipped by an ancestor cannot push the page, so it is not overflow
function clipped(el, doc) {
  for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
    const o = getComputedStyle(p);
    if (/hidden|auto|scroll|clip/.test(o.overflowX) || /hidden|auto|scroll|clip/.test(o.overflow)) return true;
  }
  return false;
}
// text that is deliberately cut to one line is not "cramped"
function truncated(cs) {
  return cs.textOverflow === 'ellipsis' || cs.whiteSpace === 'nowrap';
}
// How many lines a block of text wrapped to.
//
// NOT getClientRects().length — that returns one rect per *line box* only for inline
// elements. For a block-level <p> or <h2> it returns exactly one, always, so any rule
// gated on `getClientRects().length >= N` silently never fires. Two rules below were
// dead for that reason.
function lineCount(el, cs) {
  let lh = parseFloat(cs.lineHeight);
  if (!isFinite(lh) || lh <= 0) lh = parseFloat(cs.fontSize) * 1.2; // 'normal'
  if (!isFinite(lh) || lh <= 0) return 1;
  return Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
}

function audit(doc, W) {
  const docW = doc.documentElement.clientWidth;
  const bad = [];
  const seen = new Set();
  const note = (s) => { if (!seen.has(s)) { seen.add(s); bad.push(s); } };
  // 250px is the comfortable floor for a wrapped column, but a 320px screen cannot
  // give one that much, so scale down on the narrowest widths. `min`, not a branch:
  // the old `W >= 768 ? 250 : 0.6 * (docW - 64)` demanded 422px at 767px — a stricter
  // bar than the 250px it asked one pixel later, which flagged every legitimate
  // two-column tablet layout as cramped.
  const minProse = Math.min(250, 0.6 * (docW - 64));

  if (doc.documentElement.scrollWidth > W + 1) {
    note('OVERFLOW page +' + (doc.documentElement.scrollWidth - W));
  }

  doc.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') return;
    const tag = el.tagName.toLowerCase();
    const txt = (el.textContent || '').trim();

    if (r.right > docW + 1 && !clipped(el, doc)) note('ESCAPES ' + tag + '.' + (el.className||'').toString().split(' ').slice(0,3).join('.') + '@' + Math.round(r.right));

    // squeezed prose: real wrapped copy, not a footer column or a clipped excerpt
    if (['p','dd','li'].includes(tag) && txt.length > 60 && el.children.length === 0 &&
        !truncated(cs) && lineCount(el, cs) >= 3 &&
        !el.closest('footer, nav') && r.width < minProse) {
      note('NARROW ' + tag + ' in ' + (el.parentElement ? el.parentElement.tagName.toLowerCase() + '.' + (el.parentElement.className||'').toString().split(' ').slice(0,3).join('.') : '?') + ' ' + Math.round(r.width) + 'px "' + txt.slice(0, 16) + '…"');
    }

    if (/^h[1-4]$/.test(tag) && !truncated(cs)) {
      const lines = lineCount(el, cs);
      const limit = W <= 380 ? 4 : 3;
      if (lines > limit) note('WRAP ' + tag + ' ' + lines + ' lines "' + txt.slice(0, 20) + '…"');
    }

    // a sticky element inside a stacked (single-column) parent pins itself while the
    // rest of the column scrolls underneath it — the content overlaps the rail. This
    // is invisible to every overflow rule above: nothing is wider than anything.
    if (cs.position === 'sticky') {
      const parent = el.parentElement;
      const pcs = parent ? getComputedStyle(parent) : null;
      const tracks = pcs && pcs.display.includes('grid') ? pcs.gridTemplateColumns.split(' ').length : null;
      if (tracks === 1) note('STUCK ' + tag + '.' + (el.className||'').toString().split(' ').slice(0,2).join('.'));
    }

    // A scroll container whose scrollbar is hidden reads as absent content rather than as
    // scrollable, so content past its right edge is content nobody finds.
    //
    // Two exceptions, and both are declared in the markup rather than assumed here. <pre> is
    // recognised outright: code must not be re-wrapped. Anything else that scrolls on purpose
    // carries `data-scroll-intent`, whose value says why — a carousel with prev/next buttons is
    // not hiding anything, and a table that scrolls is reachable where a cropped one is not.
    // Declared containers are reported, not passed over: the driver prints them so an exception
    // cannot quietly become the rule.
    if (W < NAV && tag !== 'pre' && /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2) {
      const intent = el.getAttribute('data-scroll-intent');
      const where = tag + '.' + (el.className||'').toString().split(' ').slice(0,3).join('.') + ' +' + (el.scrollWidth - el.clientWidth);
      note(intent ? 'DECLARED ' + intent + ' ' + where : 'SCROLLHIDE ' + where);
    }
  });
  return bad;
}
