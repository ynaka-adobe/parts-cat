import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 992px)');

/**
 * Build the search form (controls live in JS per the nav.plain.html contract).
 */
function buildSearch() {
  const form = document.createElement('form');
  form.className = 'nav-search';
  form.setAttribute('role', 'search');
  form.action = '/en/catcorp/search';
  form.innerHTML = `
    <input type="search" name="q" aria-label="Search" placeholder="Search for part number or name">
    <button type="submit" aria-label="Search">
      <span class="nav-search-icon"></span>
    </button>`;
  return form;
}

/**
 * Collapse all open dropdowns in the given scope.
 */
function closeAllDropdowns(scope, except = null) {
  scope.querySelectorAll('.nav-drop[aria-expanded="true"]').forEach((d) => {
    if (d !== except) d.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Wire a single nav item that owns a sub-list as a click-toggle dropdown.
 */
function wireDropdown(navItem, scope) {
  navItem.classList.add('nav-drop');
  navItem.setAttribute('aria-expanded', 'false');
  navItem.setAttribute('role', 'button');
  navItem.setAttribute('tabindex', '0');

  const toggle = (e) => {
    if (e.target.closest('ul a')) return;
    e.preventDefault();
    const expanded = navItem.getAttribute('aria-expanded') === 'true';
    closeAllDropdowns(scope, navItem);
    navItem.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  };

  const label = navItem.querySelector(':scope > p');
  if (label) label.addEventListener('click', toggle);
  navItem.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'Space') toggle(e);
    if (e.code === 'Escape') navItem.setAttribute('aria-expanded', 'false');
  });
}

function closeOnOutside(nav) {
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target)) closeAllDropdowns(nav);
  });
}

function toggleMobileMenu(nav, forceClose = null) {
  const expanded = forceClose !== null
    ? !forceClose
    : nav.getAttribute('aria-expanded') === 'true';
  nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  const button = nav.querySelector('.nav-hamburger button');
  if (button) button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-expanded', 'false');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  // Section roles by source order: brand, primary nav, account utility, top utility.
  const classes = ['brand', 'sections', 'account', 'utility'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  // Brand link cleanup (strip EDS button styling).
  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('a');
    if (brandLink) brandLink.className = '';
    navBrand.append(buildSearch());
  }

  // Primary nav: wire the Shop dropdown.
  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope > ul > li').forEach((li) => {
      if (li.querySelector(':scope > ul')) wireDropdown(li, navSections);
    });
  }

  // Hamburger (mobile).
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  hamburger.innerHTML = `<button type="button" aria-controls="nav" aria-label="Open navigation">
      <span class="nav-hamburger-icon"></span>
    </button>`;
  hamburger.addEventListener('click', () => toggleMobileMenu(nav));
  nav.prepend(hamburger);

  closeOnOutside(nav);

  // Reset state when crossing the desktop/mobile breakpoint.
  isDesktop.addEventListener('change', () => {
    closeAllDropdowns(nav);
    toggleMobileMenu(nav, true);
    const btn = nav.querySelector('.nav-hamburger button');
    if (btn) btn.setAttribute('aria-label', 'Open navigation');
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
