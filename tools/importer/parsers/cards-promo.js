/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-promo. Base: cards (container block).
 * Source: https://parts.cat.com/en/catcorp
 * Generated: 2026-06-23
 *
 * Library: container block, each card = one row of 2 cells (image | text).
 * UE child model (card-promo): image (reference), text (richtext).
 * Field hints: image cell -> field:image; text cell -> field:text.
 * Source: each promo is a <section> with a feature <img>, a title <cat-heading>,
 * a body <p>, and a CTA <cat-button href> (real link -> preserved as anchor).
 */
export default function parse(element, { document }) {
  // Each promo card is a <section> (fallback to espot card/box containers).
  let items = Array.from(element.querySelectorAll(':scope section, section'));
  // Keep only sections that look like a card (have an image or a heading).
  items = items.filter((s) => s.querySelector('img, cat-heading, [class*="Headline"], h2, h3, h4'));
  if (!items.length) {
    items = Array.from(element.querySelectorAll('[class*="box-left"], [class*="box-right"], [class*="card"]'));
  }

  const cells = [];

  items.forEach((item) => {
    const img = item.querySelector('img');
    const title = item.querySelector(
      'cat-heading, [class*="Headline"], h2, h3, h4, [class*="title"]',
    );
    const body = item.querySelector(
      'p, [class*="Body_Text"], [class*="description"]',
    );
    // CTA: prefer a real anchor; the design-system <cat-button href> carries a real URL.
    const ctaAnchor = item.querySelector('a.cta, a.button, a[href]');
    const ctaButton = item.querySelector('cat-button[href], button[data-href]');

    // Image cell.
    let imageCell = '';
    if (img) {
      const imgFrag = document.createDocumentFragment();
      imgFrag.appendChild(document.createComment(' field:image '));
      imgFrag.appendChild(img);
      imageCell = [imgFrag];
    }

    // Text cell.
    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(document.createComment(' field:text '));
    let hasText = false;
    if (title) {
      const h = document.createElement('h3');
      h.textContent = title.textContent.trim();
      textFrag.appendChild(h);
      hasText = true;
    }
    if (body) {
      const p = document.createElement('p');
      p.textContent = body.textContent.trim();
      textFrag.appendChild(p);
      hasText = true;
    }
    // CTA as a linked paragraph.
    let href = null;
    let ctaLabel = null;
    if (ctaAnchor && ctaAnchor.getAttribute('href')) {
      href = ctaAnchor.getAttribute('href');
      ctaLabel = (ctaAnchor.textContent || '').trim();
    } else if (ctaButton) {
      href = ctaButton.getAttribute('href') || ctaButton.getAttribute('data-href');
      ctaLabel = (ctaButton.getAttribute('aria-label') || ctaButton.textContent || '').trim();
    }
    if (href && ctaLabel) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.setAttribute('href', href);
      a.textContent = ctaLabel;
      p.appendChild(a);
      textFrag.appendChild(p);
      hasText = true;
    }

    if (img || hasText) {
      cells.push([imageCell, hasText ? [textFrag] : '']);
    }
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-promo', cells });
  element.replaceWith(block);
}
