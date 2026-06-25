/* eslint-disable */
/* global WebImporter */
/**
 * Parser for hero-banner. Base: hero.
 * Source: https://parts.cat.com/en/catcorp
 * Generated: 2026-06-23
 *
 * Block library: 1 column, 3 rows (name / background image / content).
 * UE model (_hero-banner.json): image (reference), imageAlt (collapsed), text (richtext).
 * Field hints (xwalk): row 2 -> field:image; row 3 -> field:text.
 * imageAlt is a collapsed field (Alt suffix) -> no comment, lands on <img alt>.
 */
export default function parse(element, { document }) {
  // Background image (optional). Validated against source: <img class="hero-banner-image ...">.
  const bgImage = element.querySelector(
    'img.hero-banner-image, img[class*="bg-image"], img[data-testid="hero-smart-banner-bg-image"]',
  );

  // Content lives in the banner content wrapper, NOT the callouts (separate block).
  const contentWrap = element.querySelector('[class*="hero-smart-banner__content"]')
    || element.querySelector('[class*="banner__content"]');
  const scope = contentWrap || element;

  // Title (styled as heading) and subheading.
  const title = scope.querySelector('[class*="headline"], h1, h2, [class*="title"]');
  const subheading = scope.querySelector('[class*="description"], [class*="subheading"], p');

  // CTA(s): prefer real anchors; fall back to the design-system button text.
  const ctaLinks = Array.from(scope.querySelectorAll(
    'a.cta, a.button, [class*="actions"] a, a[data-track-event]',
  ));
  const ctaButtons = Array.from(scope.querySelectorAll(
    '[class*="actions"] cat-button, cat-button[data-track-event], [class*="actions"] button',
  ));

  const cells = [];

  // Row 2: background image cell.
  if (bgImage) {
    const imgFrag = document.createDocumentFragment();
    imgFrag.appendChild(document.createComment(' field:image '));
    imgFrag.appendChild(bgImage);
    cells.push([imgFrag]);
  } else {
    cells.push(['']);
  }

  // Row 3: text content cell.
  const textFrag = document.createDocumentFragment();
  textFrag.appendChild(document.createComment(' field:text '));
  let hasText = false;
  if (title) {
    const h = document.createElement('h2');
    h.textContent = title.textContent.trim();
    textFrag.appendChild(h);
    hasText = true;
  }
  if (subheading) {
    const p = document.createElement('p');
    p.textContent = subheading.textContent.trim();
    textFrag.appendChild(p);
    hasText = true;
  }
  if (ctaLinks.length) {
    ctaLinks.forEach((a) => {
      const p = document.createElement('p');
      p.appendChild(a);
      textFrag.appendChild(p);
    });
    hasText = true;
  } else if (ctaButtons.length) {
    // No href on the design-system button; preserve label as a styled CTA paragraph.
    ctaButtons.forEach((btn) => {
      const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim();
      if (label) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = label;
        p.appendChild(strong);
        textFrag.appendChild(p);
        hasText = true;
      }
    });
  }
  cells.push([textFrag]);

  // Empty-block guard.
  if (!bgImage && !hasText) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'hero-banner', cells });

  // The callouts strip is a sibling block nested inside this section. Replacing
  // the whole section would destroy it, so relocate it to a top-level sibling
  // (after the hero block) where the cards-callouts parser can convert it.
  const callouts = element.querySelector('[class*="hero-smart-callouts"], [class*="callouts"]');
  const parent = element.parentNode;
  parent.insertBefore(block, element);
  if (callouts) parent.insertBefore(callouts, element);
  element.remove();
}
