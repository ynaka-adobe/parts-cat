import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const isDesktop = window.matchMedia('(min-width: 992px)');

/* Inline line icons (fill: currentColor so they inherit hover color). */
const ICONS = {
  equipment: '<path d="M3 17.5h1.2a2.3 2.3 0 0 0 4.5 0H14a1.5 1.5 0 0 0 1.5-1.5v-.5h3.2l2.3-3.4V11h-4.6l-1.5-2.2A1.5 1.5 0 0 0 13.4 8H9.5A1.5 1.5 0 0 0 8 9.5V11H5.4L3 14.4v3.1Zm3.4 0a1.1 1.1 0 1 1 2.2 0 1.1 1.1 0 0 1-2.2 0ZM9.5 11V9.5h3.9l1 1.5H9.5Z"/><circle cx="18.3" cy="17.5" r="1.6"/>',
  store: '<path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"/>',
  user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z"/>',
  cart: '<path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM1 2v2h2l3.6 7.6-1.4 2.5c-.2.3-.2.6-.2 1 0 1.1.9 2 2 2h12v-2H7.4c-.1 0-.2-.1-.2-.3l.9-1.7h7.4c.8 0 1.4-.4 1.8-1l3.6-6.5c.1-.2.1-.5 0-.7-.2-.3-.5-.4-.8-.4H5.2L4.3 2H1Zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
  apps: '<path d="M4 8h4V4H4v4Zm6 12h4v-4h-4v4Zm-6 0h4v-4H4v4Zm0-6h4v-4H4v4Zm6 0h4v-4h-4v4Zm6-10v4h4V4h-4Zm-6 4h4V4h-4v4Zm6 6h4v-4h-4v4Zm0 6h4v-4h-4v4Z"/>',
  history: '<path d="M13 3a9 9 0 0 0-9 9H1l3.9 3.9.1.1L9 12H6a7 7 0 1 1 2 4.9l-1.4 1.5A9 9 0 1 0 13 3Zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12Z"/>',
  help: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 17h-2v-2h2v2Zm2.1-7.8-.9.9c-.7.7-1.2 1.4-1.2 2.9h-2v-.5c0-1.1.5-2.1 1.2-2.8l1.2-1.3c.4-.3.6-.8.6-1.4 0-1.1-.9-2-2-2s-2 .9-2 2H8a4 4 0 0 1 8 0c0 .9-.4 1.7-.9 2.2Z"/>',
};

function makeIcon(name) {
  const span = document.createElement('span');
  span.className = `nav-icon nav-icon-${name}`;
  span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
  return span;
}

/* Map a link href to an icon name (utility + account rows). */
function iconForHref(href = '') {
  if (href.includes('store-locator')) return 'store';
  if (href.includes('sign-in')) return 'user';
  if (/\/cart(\/|$|\?)/.test(href)) return 'cart';
  if (href.includes('my-equipment')) return 'equipment';
  if (href.includes('/orders')) return 'history';
  if (href.toLowerCase().includes('help')) return 'help';
  return null;
}

/* Prepend the mapped icon onto each link in a utility/account section. */
function decorateUtilityIcons(section) {
  if (!section) return;
  section.querySelectorAll('a').forEach((a) => {
    const name = iconForHref(a.getAttribute('href') || '');
    if (!name) return;
    a.prepend(makeIcon(name));
    if (name === 'cart') a.classList.add('nav-icon-only');
  });
}

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
 * Build the "Add Equipment" pill button shown beside the brand logo.
 */
function buildAddEquipment() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-add-equipment';
  btn.append(makeIcon('equipment'));
  const label = document.createElement('span');
  label.textContent = 'Add Equipment';
  btn.append(label);
  return btn;
}

/**
 * Build the icon-only app-grid (9-dot) launcher for the top utility row.
 */
function buildAppGrid() {
  const li = document.createElement('li');
  li.className = 'nav-app-grid';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'All applications');
  btn.append(makeIcon('apps'));
  li.append(btn);
  return li;
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

  // Brand link cleanup (strip EDS button styling) + Add Equipment + search.
  const navBrand = nav.querySelector('.nav-brand');
  if (navBrand) {
    const brandLink = navBrand.querySelector('a');
    if (brandLink) brandLink.className = '';
    navBrand.append(buildAddEquipment());
    navBrand.append(buildSearch());
  }

  // Primary nav: wire the Shop dropdown.
  const navSections = nav.querySelector('.nav-sections');
  if (navSections) {
    navSections.querySelectorAll(':scope > ul > li').forEach((li) => {
      if (li.querySelector(':scope > ul')) wireDropdown(li, navSections);
    });
  }

  // Top utility (Select Store / Sign in / Cart) + app-grid launcher.
  const navUtility = nav.querySelector('.nav-utility');
  decorateUtilityIcons(navUtility);
  const utilityList = navUtility && navUtility.querySelector('ul');
  if (utilityList) utilityList.append(buildAppGrid());

  // Account row (My Equipment / Order History / Help Center).
  decorateUtilityIcons(nav.querySelector('.nav-account'));

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
