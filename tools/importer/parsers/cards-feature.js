/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-feature. Base: cards (container block).
 * Source: https://parts.cat.com/en/catcorp
 * Generated: 2026-06-23
 *
 * Library: container block, each card = one row of 2 cells (image/icon | text).
 * UE child model (card-feature): image (reference), text (richtext).
 * Field hints: image cell -> field:image; text cell -> field:text.
 * Source cards (<cat-card>) use <cat-icon-*> web components (no <img> src) + a title
 * <cat-heading variant="title-sm"> and a description <cat-heading variant="body">.
 * Icon cell has no importable asset -> empty cell (no hint).
 */
export default function parse(element, { document }) {
  // Each card is a <cat-card> (fallback to generic card containers).
  let items = Array.from(element.querySelectorAll(':scope > cat-card, cat-card'));
  if (!items.length) {
    items = Array.from(element.querySelectorAll(':scope > div, [class*="card"]'));
  }

  const cells = [];

  items.forEach((item) => {
    // Icon cell: prefer a real <img>; design-system <cat-icon-*> has no src to import.
    const img = item.querySelector('img');

    // Title: smaller heading; Description: body-variant heading or paragraph.
    const title = item.querySelector(
      'cat-heading[variant*="title"], cat-heading[level="h3"], h3, [class*="title"]',
    );
    const descCandidates = Array.from(item.querySelectorAll(
      'cat-heading[variant="body"], cat-heading[variant*="body"], p, [class*="description"]',
    ));
    // Avoid re-selecting the title node as the description.
    const desc = descCandidates.find((n) => n !== title) || null;
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

    if (img || hasText) {
      cells.push([imageCell, hasText ? [textFrag] : '']);
    }
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-feature', cells });
  element.replaceWith(block);
}
