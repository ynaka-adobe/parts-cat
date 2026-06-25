/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: parts.cat.com site-wide cleanup.
 *
 * All selectors below are verified against the captured DOM in
 * migration-work/cleaned.html. The cleaned.html represents only the <main>
 * content; the site header (#main-cat-header) and footer (cat-footer) are
 * site furniture and are already excluded by the scraper, so they are not
 * targeted here.
 *
 * Non-authorable removal of note:
 *   .customer-account_customer-account-wrapper__vIsbQ — the interactive
 *   equipment-finder widget inside the "Shop Cat Parts" section. It is built
 *   from cat-side-menu (My Equipment / Recently Viewed tabs) and cat-tabs
 *   forms (By Serial Number / By Model inputs, Add/Cancel buttons). This is a
 *   dynamic, JS-driven widget with no static authorable content, so it is
 *   removed. The section heading ("Shop Cat Parts") is authorable and is kept.
 */
const TransformHook = {
  beforeTransform: 'beforeTransform',
  afterTransform: 'afterTransform',
};

export default function transform(hookName, element, payload) {
  if (hookName === TransformHook.beforeTransform) {
    // Remove the non-authorable interactive equipment-finder widget before
    // block parsing so its forms/inputs do not get pulled into any block cell.
    // Found in cleaned.html: <div class="customer-account_customer-account-wrapper__vIsbQ ...">
    WebImporter.DOMUtils.remove(element, [
      '.customer-account_customer-account-wrapper__vIsbQ',
    ]);

    // The Cat design system renders headings as custom <cat-heading> web
    // components (e.g. <cat-heading variant="headline" level="h2">). html2md
    // does not recognise these as headings and emits them as plain paragraphs,
    // so section-level headings ("Shop Cat Parts", "Why Choose Cat", etc.) lose
    // their heading semantics. Convert each cat-heading to a real <hN> using its
    // `level` attribute (default h2) before parsing. Block parsers read heading
    // text via textContent, so this conversion is safe for headings they consume.
    element.querySelectorAll('cat-heading').forEach((ch) => {
      const level = (ch.getAttribute('level') || 'h2').toLowerCase();
      const tag = /^h[1-6]$/.test(level) ? level : 'h2';
      const h = element.ownerDocument.createElement(tag);
      h.innerHTML = ch.innerHTML;
      ch.replaceWith(h);
    });
  }

  if (hookName === TransformHook.afterTransform) {
    // Strip event/tracking attributes present in the captured DOM (e.g.
    // cat-button data-track-event="e_primaryCTA") so they do not leak into
    // the authored content.
    element.querySelectorAll('[data-track-event]').forEach((el) => {
      el.removeAttribute('data-track-event');
    });

    // Safe leftover element cleanup.
    WebImporter.DOMUtils.remove(element, ['link', 'noscript', 'iframe', 'script']);
  }
}
