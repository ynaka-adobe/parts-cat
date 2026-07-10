import { getMetadata, decorateBlock, loadBlock } from './aem.js';

/** AEM Universal Editor iframe; skip Target so at.js does not fight UE/CSP. */
export function isUePreviewHost(hostname = window.location.hostname) {
  return /\.(?:stage-ue|ue)\.da\.live$/.test(hostname);
}

/** Homepage only — Target hero/page-load activities are not used on inner pages. */
export function isHomePage(pathname = window.location.pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  return path === '/' || path === '/index';
}

/**
 * @param {unknown} e
 * @param {Element} [el]
 */
function logTargetError(e, el) {
  // eslint-disable-next-line no-console
  console.error('[target]', e, el);
}

// Offer content is authored EDS markup: .target-offer > div (section) > div.block
const TARGET_OFFER_BLOCK_SEL = '.target-offer > div > div[class]:not([data-block-status])';

/** Decorate + load any not-yet-decorated blocks currently inside a target-offer. */
function decorateInjectedBlocks() {
  return Promise.all([...document.querySelectorAll(TARGET_OFFER_BLOCK_SEL)].map((block) => {
    decorateBlock(block);
    return loadBlock(block);
  }));
}

let targetOfferObserver = null;

/**
 * EDS block decoration only runs during initial page load. Markup that Target
 * injects afterwards into a `.target-offer` slot keeps its raw authored structure
 * (plain table/cell divs), so blocks render unstyled. Decorate blocks Target
 * dropped in so they get their expected structure, CSS, and JS behaviour.
 *
 * at.js applies offers asynchronously (and may re-apply), so besides an immediate
 * pass we watch the DOM and decorate blocks as soon as they are injected.
 */
export async function decorateTargetOfferBlocks() {
  await decorateInjectedBlocks();

  if (targetOfferObserver) return;
  targetOfferObserver = new MutationObserver(() => {
    // Only undecorated blocks match the selector, so this is a no-op once decorated.
    if (document.querySelector(TARGET_OFFER_BLOCK_SEL)) decorateInjectedBlocks();
  });
  targetOfferObserver.observe(document.body, { childList: true, subtree: true });
}

export async function loadTarget() {
  if (isUePreviewHost()) return;
  const targetMeta = getMetadata('target');
  if (!targetMeta) return;

  const serverDomain = getMetadata('target-server-domain')?.trim();
  window.targetGlobalSettings = {
    secureOnly: true,
    overrideMboxEdgeServer: false,
    ...(serverDomain ? { serverDomain } : {}),
  };

  try {
    await import('../deps/at/at.js');
    const pageLoadRequest = { execute: { pageLoad: {} } };
    const offers = await window.adobe.target.getOffers({
      request: pageLoadRequest,
    });

    if (typeof window.adobe.target.applyOffers === 'function') {
      await window.adobe.target.applyOffers({
        request: pageLoadRequest,
        response: offers,
      });
    } else {
      offers?.execute?.pageLoad?.options?.forEach((opt) => {
        const payload = opt?.content?.[0];
        if (!payload) return;
        const { cssSelector, content } = payload;
        if (!cssSelector || content == null) return;
        const el = document.querySelector(cssSelector);
        if (el) el.outerHTML = content;
      });
    }
    await decorateTargetOfferBlocks();
  } catch (e) {
    logTargetError(e, document.body);
  }
}

/**
 * Legacy mbox flow (getOffer + applyOffer). Runs after blocks render.
 * Opt-in via meta target-mbox-hero and optional target-mbox-hero-selector.
 */
export async function applyTargetHeroMboxIfConfigured() {
  if (isUePreviewHost()) return;
  const mbox = getMetadata('target-mbox-hero')?.trim();
  if (!mbox) return;

  const selectorList = (getMetadata('target-mbox-hero-selector')?.trim()
    || '.hero-promo, .hero.block .hero-inner')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const t = window.adobe?.target;
  if (!t?.getOffer || !t?.applyOffer) return;

  const resolveSelector = () => {
    for (let i = 0; i < selectorList.length; i += 1) {
      const el = document.querySelector(selectorList[i]);
      if (el) return { el, selector: selectorList[i] };
    }
    return null;
  };

  await new Promise((resolve) => {
    t.getOffer({
      mbox,
      success(offers) {
        const match = resolveSelector();
        if (!match) {
          resolve();
          return;
        }
        t.applyOffer({ mbox, selector: match.selector, offer: offers });
        decorateTargetOfferBlocks().finally(resolve);
      },
      error: resolve,
    });
  });
}
