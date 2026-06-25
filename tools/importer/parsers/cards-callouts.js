/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-callouts. Base: cards (container block).
 * Source: https://parts.cat.com/en/catcorp
 * Generated: 2026-06-23
 *
 * Library: container block, each card = one row of 2 cells (image/icon | text).
 * UE child model (card-callouts): image (reference), text (richtext).
 * Field hints: image cell -> field:image; text cell -> field:text.
 * Source callouts use <cat-icon-*> web components (no <img> src) + a <cat-heading> label,
 * no description, no CTA. The icon cell has no importable asset -> empty cell (no hint).
 */
export default function parse(element, { document }) {
  // Each callout/card is a list item (with icon fallback to generic card containers).
  let items = Array.from(element.querySelectorAll(
    '[class*="callouts__list"] > li',
  ));
  if (!items.length) {
    items = Array.from(element.querySelectorAll(':scope ul > li, :scope > div > div'));
  }

  const cells = [];

  items.forEach((item) => {
    // Icon cell: prefer a real <img>; design-system <cat-icon-*> has no src to import.
    const img = item.querySelector('img');

    // Label / title for the text cell.
    const title = item.querySelector(
      '[class*="callouts__title"], cat-heading, h2, h3, [class*="title"]',
    );

    // Optional description / CTA (none in current source, kept for resilience).
    const desc = item.querySelector('p, [class*="description"]');
    const cta = item.querySelector('a.cta, a.button, a[data-track-event]');

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
    if (desc) {
      const p = document.createElement('p');
      p.textContent = desc.textContent.trim();
      textFrag.appendChild(p);
      hasText = true;
    }
    if (cta) {
      const p = document.createElement('p');
      p.appendChild(cta);
      textFrag.appendChild(p);
      hasText = true;
    }

    // Only emit a card row if it has either an image or text content.
    if (img || hasText) {
      cells.push([imageCell, hasText ? [textFrag] : '']);
    }
  });

  // Empty-block guard.
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-callouts', cells });
  element.replaceWith(block);
}
