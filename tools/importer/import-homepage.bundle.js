/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-homepage.js
  var import_homepage_exports = {};
  __export(import_homepage_exports, {
    default: () => import_homepage_default
  });

  // tools/importer/parsers/hero-banner.js
  function parse(element, { document }) {
    const bgImage = element.querySelector(
      'img.hero-banner-image, img[class*="bg-image"], img[data-testid="hero-smart-banner-bg-image"]'
    );
    const contentWrap = element.querySelector('[class*="hero-smart-banner__content"]') || element.querySelector('[class*="banner__content"]');
    const scope = contentWrap || element;
    const title = scope.querySelector('[class*="headline"], h1, h2, [class*="title"]');
    const subheading = scope.querySelector('[class*="description"], [class*="subheading"], p');
    const ctaLinks = Array.from(scope.querySelectorAll(
      'a.cta, a.button, [class*="actions"] a, a[data-track-event]'
    ));
    const ctaButtons = Array.from(scope.querySelectorAll(
      '[class*="actions"] cat-button, cat-button[data-track-event], [class*="actions"] button'
    ));
    const cells = [];
    if (bgImage) {
      const imgFrag = document.createDocumentFragment();
      imgFrag.appendChild(document.createComment(" field:image "));
      imgFrag.appendChild(bgImage);
      cells.push([imgFrag]);
    } else {
      cells.push([""]);
    }
    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(document.createComment(" field:text "));
    let hasText = false;
    if (title) {
      const h = document.createElement("h2");
      h.textContent = title.textContent.trim();
      textFrag.appendChild(h);
      hasText = true;
    }
    if (subheading) {
      const p = document.createElement("p");
      p.textContent = subheading.textContent.trim();
      textFrag.appendChild(p);
      hasText = true;
    }
    if (ctaLinks.length) {
      ctaLinks.forEach((a) => {
        const p = document.createElement("p");
        p.appendChild(a);
        textFrag.appendChild(p);
      });
      hasText = true;
    } else if (ctaButtons.length) {
      ctaButtons.forEach((btn) => {
        const label = (btn.getAttribute("aria-label") || btn.textContent || "").trim();
        if (label) {
          const p = document.createElement("p");
          const strong = document.createElement("strong");
          strong.textContent = label;
          p.appendChild(strong);
          textFrag.appendChild(p);
          hasText = true;
        }
      });
    }
    cells.push([textFrag]);
    if (!bgImage && !hasText) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "hero-banner", cells });
    const callouts = element.querySelector('[class*="hero-smart-callouts"], [class*="callouts"]');
    const parent = element.parentNode;
    parent.insertBefore(block, element);
    if (callouts) parent.insertBefore(callouts, element);
    element.remove();
  }

  // tools/importer/parsers/cards-callouts.js
  function parse2(element, { document }) {
    let items = Array.from(element.querySelectorAll(
      '[class*="callouts__list"] > li'
    ));
    if (!items.length) {
      items = Array.from(element.querySelectorAll(":scope ul > li, :scope > div > div"));
    }
    const cells = [];
    items.forEach((item) => {
      const img = item.querySelector("img");
      const title = item.querySelector(
        '[class*="callouts__title"], cat-heading, h2, h3, [class*="title"]'
      );
      const desc = item.querySelector('p, [class*="description"]');
      const cta = item.querySelector("a.cta, a.button, a[data-track-event]");
      let imageCell = "";
      if (img) {
        const imgFrag = document.createDocumentFragment();
        imgFrag.appendChild(document.createComment(" field:image "));
        imgFrag.appendChild(img);
        imageCell = [imgFrag];
      }
      const textFrag = document.createDocumentFragment();
      textFrag.appendChild(document.createComment(" field:text "));
      let hasText = false;
      if (title) {
        const h = document.createElement("h3");
        h.textContent = title.textContent.trim();
        textFrag.appendChild(h);
        hasText = true;
      }
      if (desc) {
        const p = document.createElement("p");
        p.textContent = desc.textContent.trim();
        textFrag.appendChild(p);
        hasText = true;
      }
      if (cta) {
        const p = document.createElement("p");
        p.appendChild(cta);
        textFrag.appendChild(p);
        hasText = true;
      }
      if (img || hasText) {
        cells.push([imageCell, hasText ? [textFrag] : ""]);
      }
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-callouts", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-feature.js
  function parse3(element, { document }) {
    let items = Array.from(element.querySelectorAll(":scope > cat-card, cat-card"));
    if (!items.length) {
      items = Array.from(element.querySelectorAll(':scope > div, [class*="card"]'));
    }
    const cells = [];
    items.forEach((item) => {
      const img = item.querySelector("img");
      const title = item.querySelector(
        'cat-heading[variant*="title"], cat-heading[level="h3"], h3, [class*="title"]'
      );
      const descCandidates = Array.from(item.querySelectorAll(
        'cat-heading[variant="body"], cat-heading[variant*="body"], p, [class*="description"]'
      ));
      const desc = descCandidates.find((n) => n !== title) || null;
      const cta = item.querySelector("a.cta, a.button, a[data-track-event]");
      let imageCell = "";
      if (img) {
        const imgFrag = document.createDocumentFragment();
        imgFrag.appendChild(document.createComment(" field:image "));
        imgFrag.appendChild(img);
        imageCell = [imgFrag];
      }
      const textFrag = document.createDocumentFragment();
      textFrag.appendChild(document.createComment(" field:text "));
      let hasText = false;
      if (title) {
        const h = document.createElement("h3");
        h.textContent = title.textContent.trim();
        textFrag.appendChild(h);
        hasText = true;
      }
      if (desc) {
        const p = document.createElement("p");
        p.textContent = desc.textContent.trim();
        textFrag.appendChild(p);
        hasText = true;
      }
      if (cta) {
        const p = document.createElement("p");
        p.appendChild(cta);
        textFrag.appendChild(p);
        hasText = true;
      }
      if (img || hasText) {
        cells.push([imageCell, hasText ? [textFrag] : ""]);
      }
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-feature", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-category.js
  function parse4(element, { document }) {
    let items = Array.from(element.querySelectorAll(":scope > cat-grid-item, cat-grid-item"));
    if (!items.length) {
      items = Array.from(element.querySelectorAll(':scope > a, [class*="grid-item"], [class*="category-card"]'));
    }
    const cells = [];
    items.forEach((item) => {
      const link = item.querySelector("a[href]") || (item.matches("a[href]") ? item : null);
      const img = item.querySelector("img");
      const title = item.querySelector(
        '[class*="card__title"], cat-heading, h2, h3, [class*="title"]'
      );
      let imageCell = "";
      if (img) {
        const imgFrag = document.createDocumentFragment();
        imgFrag.appendChild(document.createComment(" field:image "));
        imgFrag.appendChild(img);
        imageCell = [imgFrag];
      }
      const textFrag = document.createDocumentFragment();
      textFrag.appendChild(document.createComment(" field:text "));
      let hasText = false;
      const label = title ? title.textContent.trim() : link ? (link.getAttribute("aria-label") || "").trim() : "";
      if (label) {
        const h = document.createElement("h3");
        if (link && link.getAttribute("href")) {
          const a = document.createElement("a");
          a.setAttribute("href", link.getAttribute("href"));
          a.textContent = label;
          h.appendChild(a);
        } else {
          h.textContent = label;
        }
        textFrag.appendChild(h);
        hasText = true;
      }
      if (img || hasText) {
        cells.push([imageCell, hasText ? [textFrag] : ""]);
      }
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-category", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-promo.js
  function parse5(element, { document }) {
    let items = Array.from(element.querySelectorAll(":scope section, section"));
    items = items.filter((s) => s.querySelector('img, cat-heading, [class*="Headline"], h2, h3, h4'));
    if (!items.length) {
      items = Array.from(element.querySelectorAll('[class*="box-left"], [class*="box-right"], [class*="card"]'));
    }
    const cells = [];
    items.forEach((item) => {
      const img = item.querySelector("img");
      const title = item.querySelector(
        'cat-heading, [class*="Headline"], h2, h3, h4, [class*="title"]'
      );
      const body = item.querySelector(
        'p, [class*="Body_Text"], [class*="description"]'
      );
      const ctaAnchor = item.querySelector("a.cta, a.button, a[href]");
      const ctaButton = item.querySelector("cat-button[href], button[data-href]");
      let imageCell = "";
      if (img) {
        const imgFrag = document.createDocumentFragment();
        imgFrag.appendChild(document.createComment(" field:image "));
        imgFrag.appendChild(img);
        imageCell = [imgFrag];
      }
      const textFrag = document.createDocumentFragment();
      textFrag.appendChild(document.createComment(" field:text "));
      let hasText = false;
      if (title) {
        const h = document.createElement("h3");
        h.textContent = title.textContent.trim();
        textFrag.appendChild(h);
        hasText = true;
      }
      if (body) {
        const p = document.createElement("p");
        p.textContent = body.textContent.trim();
        textFrag.appendChild(p);
        hasText = true;
      }
      let href = null;
      let ctaLabel = null;
      if (ctaAnchor && ctaAnchor.getAttribute("href")) {
        href = ctaAnchor.getAttribute("href");
        ctaLabel = (ctaAnchor.textContent || "").trim();
      } else if (ctaButton) {
        href = ctaButton.getAttribute("href") || ctaButton.getAttribute("data-href");
        ctaLabel = (ctaButton.getAttribute("aria-label") || ctaButton.textContent || "").trim();
      }
      if (href && ctaLabel) {
        const p = document.createElement("p");
        const a = document.createElement("a");
        a.setAttribute("href", href);
        a.textContent = ctaLabel;
        p.appendChild(a);
        textFrag.appendChild(p);
        hasText = true;
      }
      if (img || hasText) {
        cells.push([imageCell, hasText ? [textFrag] : ""]);
      }
    });
    if (!cells.length) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "cards-promo", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/parts-cat-cleanup.js
  var TransformHook = {
    beforeTransform: "beforeTransform",
    afterTransform: "afterTransform"
  };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        ".customer-account_customer-account-wrapper__vIsbQ"
      ]);
      element.querySelectorAll("cat-heading").forEach((ch) => {
        const level = (ch.getAttribute("level") || "h2").toLowerCase();
        const tag = /^h[1-6]$/.test(level) ? level : "h2";
        const h = element.ownerDocument.createElement(tag);
        h.innerHTML = ch.innerHTML;
        ch.replaceWith(h);
      });
    }
    if (hookName === TransformHook.afterTransform) {
      element.querySelectorAll("[data-track-event]").forEach((el) => {
        el.removeAttribute("data-track-event");
      });
      WebImporter.DOMUtils.remove(element, ["link", "noscript", "iframe", "script"]);
    }
  }

  // tools/importer/transformers/parts-cat-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform2(hookName, element, payload) {
    if (hookName !== TransformHook2.afterTransform) return;
    const sections = payload && payload.template && payload.template.sections;
    if (!Array.isArray(sections) || sections.length < 2) return;
    const doc = element.ownerDocument;
    const resolve = (selector) => {
      if (!selector) return null;
      const rel = selector.replace(/^\s*body\s*>\s*main\s*>?\s*/i, "").trim();
      let el = null;
      if (rel) {
        try {
          el = element.querySelector(rel);
        } catch (e) {
          el = null;
        }
      }
      if (!el) {
        try {
          el = element.querySelector(selector);
        } catch (e) {
          el = null;
        }
      }
      return el;
    };
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const sectionEl = resolve(section.selector);
      if (!sectionEl) continue;
      if (section.style) {
        const metadataBlock = WebImporter.Blocks.createBlock(doc, {
          name: "Section Metadata",
          cells: { style: section.style }
        });
        if (sectionEl.parentNode) {
          sectionEl.parentNode.insertBefore(metadataBlock, sectionEl.nextSibling);
        }
      }
      if (i > 0 && sectionEl.parentNode) {
        const hr = doc.createElement("hr");
        sectionEl.parentNode.insertBefore(hr, sectionEl);
      }
    }
  }

  // tools/importer/transformers/parts-cat-dm-images.js
  function detectDynamicMediaUrl(urlStr) {
    let u;
    try {
      u = new URL(urlStr, "https://x/");
    } catch (e) {
      return false;
    }
    if (u.pathname.startsWith("/is/image/")) {
      return "scene7";
    }
    if (/^delivery-p\d+-e\d+\.adobeaemcloud\.com$/.test(u.hostname) && u.pathname.startsWith("/adobe/assets/urn:")) {
      return "dm-openapi";
    }
    return false;
  }
  var LINKED_DM_INLINE_WRAPPER_TAGS = /* @__PURE__ */ new Set(["PICTURE"]);
  var LINKED_DM_WRAPPER_SIBLING_TAGS = /* @__PURE__ */ new Set(["SOURCE"]);
  function findLinkedDmCarrier(img) {
    if (!img || !img.parentElement) return null;
    let node = img;
    let parent = img.parentElement;
    while (parent && LINKED_DM_INLINE_WRAPPER_TAGS.has(parent.tagName)) {
      let foundNode = false;
      for (const child of parent.children) {
        if (child === node) {
          foundNode = true;
        } else if (!LINKED_DM_WRAPPER_SIBLING_TAGS.has(child.tagName)) {
          return null;
        }
      }
      if (!foundNode) return null;
      node = parent;
      parent = parent.parentElement;
    }
    if (!parent || parent.tagName !== "A") return null;
    if (parent.children.length !== 1 || parent.children[0] !== node) return null;
    if (parent.textContent.trim() !== "") return null;
    return parent;
  }
  var EMPTY_ALT_SENTINEL = "Image without alt text";
  function altToLinkText(alt) {
    return alt || EMPTY_ALT_SENTINEL;
  }
  function transform3(hookName, element, payload) {
    if (hookName !== "afterTransform") return;
    const doc = element.ownerDocument;
    element.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!detectDynamicMediaUrl(src)) return;
      const alt = img.getAttribute("alt") || "";
      const linkedAnchor = findLinkedDmCarrier(img);
      if (linkedAnchor) {
        linkedAnchor.setAttribute("title", src);
        linkedAnchor.textContent = altToLinkText(alt);
        return;
      }
      const parent = img.parentElement;
      if (parent && parent.tagName === "A") {
        console.warn("DM image inside mixed-content anchor, skipped:", src);
        return;
      }
      const a = doc.createElement("a");
      a.href = src;
      a.textContent = altToLinkText(alt);
      img.replaceWith(a);
    });
  }

  // tools/importer/import-homepage.js
  var parsers = {
    "hero-banner": parse,
    "cards-callouts": parse2,
    "cards-feature": parse3,
    "cards-category": parse4,
    "cards-promo": parse5
  };
  var PAGE_TEMPLATE = {
    name: "homepage",
    description: "Cat Parts Store homepage with hero smart banner, callouts, shop parts equipment finder, why-choose cards, shop by category grid, and promotional sections",
    urls: [
      "https://parts.cat.com/en/catcorp"
    ],
    blocks: [
      {
        name: "hero-banner",
        instances: ["section.hero-banner_hero-smart-banner__yTc9k"]
      },
      {
        name: "cards-callouts",
        instances: [".hero-banner_hero-smart-callouts__FKgJI"]
      },
      {
        name: "cards-feature",
        instances: ['div[data-testid="cat-value-wrapper"]']
      },
      {
        name: "cards-category",
        instances: ["cat-grid.shop-category-card_category-grid__D_lJw"]
      },
      {
        name: "cards-promo",
        instances: [".middle-espot-container_home-page-espot__container__xWsRj"]
      }
    ],
    sections: [
      {
        id: "section-1-hero",
        name: "Hero",
        selector: "body > main > section.hero-banner_hero-smart-banner__yTc9k",
        style: null,
        blocks: ["hero-banner", "cards-callouts"],
        defaultContent: []
      },
      {
        id: "section-2-shop-parts",
        name: "Shop Cat Parts",
        selector: "body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container:nth-of-type(1)",
        style: null,
        blocks: [],
        defaultContent: ['cat-layout-container:nth-of-type(1) cat-heading[variant="headline"]']
      },
      {
        id: "section-3-why-choose-cat",
        name: "Why Choose Cat",
        selector: "body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container.Homepage_home-section-container__catvalue_section__xEmRV",
        style: "dark",
        blocks: ["cards-feature"],
        defaultContent: ["cat-value_cat-value-section___M6hj cat-heading[decorator]"]
      },
      {
        id: "section-4-shop-by-category",
        name: "Shop By Category",
        selector: "body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container:nth-of-type(3) > div:nth-of-type(1)",
        style: null,
        blocks: ["cards-category"],
        defaultContent: ["#categories-section"]
      },
      {
        id: "section-5-get-the-most",
        name: "Get the Most Out of Your Equipment",
        selector: "body > main > div.Homepage_home-section-container__lu7zY > cat-layout-container:nth-of-type(3) > div:nth-of-type(2)",
        style: null,
        blocks: ["cards-promo"],
        defaultContent: []
      }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : [],
    transform3
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), {
      template: PAGE_TEMPLATE
    });
    transformers.forEach((transformerFn) => {
      try {
        transformerFn.call(null, hookName, element, enhancedPayload);
      } catch (e) {
        console.error(`Transformer failed at ${hookName}:`, e);
      }
    });
  }
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
            section: blockDef.section || null
          });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_homepage_default = {
    transform: (payload) => {
      const { document, url, params } = payload;
      const main = document.body;
      executeTransformers("beforeTransform", main, payload);
      const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
      pageBlocks.forEach((block) => {
        if (!block.element.parentNode) return;
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
      executeTransformers("afterTransform", main, payload);
      const hr = document.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document);
      WebImporter.rules.transformBackgroundImages(main, document);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const path = WebImporter.FileUtils.sanitizePath(
        new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html$/, "")
      );
      return [{
        element: main,
        path,
        report: {
          title: document.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_homepage_exports);
})();
