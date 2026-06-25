/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: parts.cat.com section breaks and section metadata.
 *
 * Runs in afterTransform only. Reads payload.template.sections (from
 * page-templates.json) and, for the homepage template (5 sections):
 *   - inserts an <hr> before every section except the first (4 breaks)
 *   - inserts a "Section Metadata" block for every section that has a
 *     non-null `style` (only section-3 "Why Choose Cat" has style "dark")
 *
 * Section selectors come from the template's section definitions, which were
 * derived from the captured DOM in migration-work/cleaned.html.
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

export default function transform(hookName, element, payload) {
  if (hookName !== TransformHook.afterTransform) return;

  const sections = payload && payload.template && payload.template.sections;
  if (!Array.isArray(sections) || sections.length < 2) return;

  const doc = element.ownerDocument;

  // Resolve each section to its first element under `element`. The template
  // selectors are rooted at `body > main`; the importer runs the transformer
  // on the <main> element, so strip the `body > main` prefix and resolve the
  // remainder relative to `element`. Fall back to the raw selector.
  const resolve = (selector) => {
    if (!selector) return null;
    const rel = selector
      .replace(/^\s*body\s*>\s*main\s*>?\s*/i, '')
      .trim();
    let el = null;
    if (rel) {
      try { el = element.querySelector(rel); } catch (e) { el = null; }
    }
    if (!el) {
      try { el = element.querySelector(selector); } catch (e) { el = null; }
    }
    return el;
  };

  // Process sections in reverse order so inserting nodes does not shift the
  // positions of sections we have not handled yet.
  for (let i = sections.length - 1; i >= 0; i -= 1) {
    const section = sections[i];
    const sectionEl = resolve(section.selector);
    if (!sectionEl) continue;

    // Section Metadata block for sections that declare a style.
    if (section.style) {
      const metadataBlock = WebImporter.Blocks.createBlock(doc, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });
      if (sectionEl.parentNode) {
        sectionEl.parentNode.insertBefore(metadataBlock, sectionEl.nextSibling);
      }
    }

    // Section break before every section except the first.
    if (i > 0 && sectionEl.parentNode) {
      const hr = doc.createElement('hr');
      sectionEl.parentNode.insertBefore(hr, sectionEl);
    }
  }
}
