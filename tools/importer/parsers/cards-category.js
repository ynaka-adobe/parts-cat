/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-category. Base: cards (container block).
 * Source: https://parts.cat.com/en/catcorp
 * Generated: 2026-06-23
 *
 * Library: container block, each card = one row of 2 cells (image | text).
 * UE child model (card-category): image (reference), text (richtext).
 * Field hints: image cell -> field:image; text cell -> field:text.
 * Source: <cat-grid-item> cards, each an <a href> wrapping an <img> + a category
 * title <cat-heading>. No description. Title is linked -> preserve as anchor in text cell.
 */
export default function parse(element, { document }) {
  // Each category card is a grid item (fallback to anchor-wrapped cards).
  let items = Array.from(element.querySelectorAll(':scope > cat-grid-item, cat-grid-item'));
  if (!items.length) {
    items = Array.from(element.querySelectorAll(':scope > a, [class*="grid-item"], [class*="category-card"]'));
  }

  const cells = [];

  items.forEach((item) => {
    const link = item.querySelector('a[href]') || (item.matches('a[href]') ? item : null);
    const img = item.querySelector('img');
    const title = item.querySelector(
      '[class*="card__title"], cat-heading, h2, h3, [class*="title"]',
    );

    // Image cell.
    let imageCell = '';
    if (img) {
      const imgFrag = document.createDocumentFragment();
      imgFrag.appendChild(document.createComment(' field:image '));
      imgFrag.appendChild(img);
      imageCell = [imgFrag];
    }

    // Text cell: linked title (preserve the category href).
    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(document.createComment(' field:text '));
    let hasText = false;
    const label = title ? title.textContent.trim() : (link ? (link.getAttribute('aria-label') || '').trim() : '');
    if (label) {
      const h = document.createElement('h3');
      if (link && link.getAttribute('href')) {
        const a = document.createElement('a');
        a.setAttribute('href', link.getAttribute('href'));
        a.textContent = label;
        h.appendChild(a);
      } else {
        h.textContent = label;
      }
      textFrag.appendChild(h);
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

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-category', cells });
  element.replaceWith(block);
}
