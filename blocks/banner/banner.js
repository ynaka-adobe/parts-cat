import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  // Rows: row 0 = image, row 1 = description + CTA
  // Authors may also put image and text in separate cells of one row.
  // Normalize into: .banner-image, .banner-body (description + CTA).

  const cells = [...block.querySelectorAll(':scope > div > div')];

  let imageCell = null;
  let bodyCell = null;

  cells.forEach((cell) => {
    if (!imageCell && cell.querySelector('picture, img')) {
      imageCell = cell;
    } else if (!bodyCell) {
      bodyCell = cell;
    }
  });

  // Rebuild block DOM
  block.innerHTML = '';

  if (imageCell) {
    imageCell.className = 'banner-image';
    // Replace with optimized picture
    imageCell.querySelectorAll('picture > img').forEach((img) => {
      const widths = block.classList.contains('medium-rectangle')
        ? [{ width: '300' }]
        : [{ width: '1200' }, { media: '(min-width: 900px)', width: '1200' }];
      img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, widths));
    });
    block.append(imageCell);
  }

  if (bodyCell) {
    bodyCell.className = 'banner-body';
    // Style the CTA link as a button
    bodyCell.querySelectorAll('a').forEach((a) => a.classList.add('button'));
    block.append(bodyCell);
  }
}
