/* eslint-disable */
/* global WebImporter */

// PARSER IMPORTS
import heroBannerParser from './parsers/hero-banner.js';
import cardsCalloutsParser from './parsers/cards-callouts.js';
import cardsFeatureParser from './parsers/cards-feature.js';
import cardsCategoryParser from './parsers/cards-category.js';
import cardsPromoParser from './parsers/cards-promo.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/parts-cat-cleanup.js';
import sectionsTransformer from './transformers/parts-cat-sections.js';
import dmImagesTransformer from './transformers/parts-cat-dm-images.js';

// PARSER REGISTRY
const parsers = {
  'hero-banner': heroBannerParser,
  'cards-callouts': cardsCalloutsParser,
  'cards-feature': cardsFeatureParser,
  'cards-category': cardsCategoryParser,
  'cards-promo': cardsPromoParser,
};

// PAGE TEMPLATE CONFIGURATION - Embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'homepage',
  description: 'Cat Parts Store homepage with hero smart banner, callouts, shop parts equipment finder, why-choose cards, shop by category grid, and promotional sections',
  urls: [
    'https://parts.cat.com/en/catcorp',
  ],
  blocks: [
    {
      name: 'hero-banner',
      instances: ['section.hero-banner_hero-smart-banner__yTc9k'],
    },
    {
      name: 'cards-callouts',
      instances: ['.hero-banner_hero-smart-callouts__FKgJI'],
    },
    {
      name: 'cards-feature',
      instances: ['div[data-testid="cat-value-wrapper"]'],
    },
    {
      name: 'cards-category',
      instances: ['cat-grid.shop-category-card_category-grid__D_lJw'],
    },
    {
      name: 'cards-promo',
      instances: ['.middle-espot-container_home-page-espot__container__xWsRj'],
    },
  ],
  sections: [
    {
      id: 'section-1-hero',
      name: 'Hero',
      selector: 'body > main > section.hero-banner_hero-smart-banner__yTc9k',
      style: null,
      blocks: ['hero-banner', 'cards-callouts'],
      defaultContent: [],
    },
    {
      id: 'section-2-shop-parts',
      name: 'Shop Cat Parts',
      selector: 'body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container:nth-of-type(1)',
      style: null,
      blocks: [],
      defaultContent: ['cat-layout-container:nth-of-type(1) cat-heading[variant="headline"]'],
    },
    {
      id: 'section-3-why-choose-cat',
      name: 'Why Choose Cat',
      selector: 'body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container.Homepage_home-section-container__catvalue_section__xEmRV',
      style: 'dark',
      blocks: ['cards-feature'],
      defaultContent: ['cat-value_cat-value-section___M6hj cat-heading[decorator]'],
    },
    {
      id: 'section-4-shop-by-category',
      name: 'Shop By Category',
      selector: 'body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container:nth-of-type(3) > div:nth-of-type(1)',
      style: null,
      blocks: ['cards-category'],
      defaultContent: ['#categories-section'],
    },
    {
      id: 'section-5-get-the-most',
      name: 'Get the Most Out of Your Equipment',
      selector: 'body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container:nth-of-type(3) > div:nth-of-type(2)',
      style: null,
      blocks: ['cards-promo'],
      defaultContent: [],
    },
  ],
};

// TRANSFORMER REGISTRY
// cleanup runs in beforeTransform; sections + dm-images run in afterTransform.
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
  dmImagesTransformer,
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = {
    ...payload,
    template: PAGE_TEMPLATE,
  };

  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];

  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name,
          selector,
          element,
          section: blockDef.section || null,
        });
      });
    });
  });

  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;

    const main = document.body;

    // 1. beforeTransform (initial cleanup)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return; // Already replaced by earlier parser
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. afterTransform (section breaks/metadata + DM image rewrite)
    executeTransformers('afterTransform', main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Generate sanitized path
    const path = WebImporter.FileUtils.sanitizePath(
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, ''),
    );

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
