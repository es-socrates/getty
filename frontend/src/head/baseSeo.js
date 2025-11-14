const META_TARGETS = [
  { attr: 'name', key: 'description' },
  { attr: 'name', key: 'keywords' },
  { attr: 'property', key: 'og:title' },
  { attr: 'property', key: 'og:description' },
  { attr: 'property', key: 'og:url' },
  { attr: 'property', key: 'og:type' },
  { attr: 'property', key: 'og:site_name' },
  { attr: 'property', key: 'og:locale' },
  { attr: 'property', key: 'og:image' },
  { attr: 'property', key: 'og:image:alt' },
  { attr: 'property', key: 'og:image:secure_url' },
  { attr: 'property', key: 'og:image:type' },
  { attr: 'property', key: 'og:image:width' },
  { attr: 'property', key: 'og:image:height' },
  { attr: 'name', key: 'twitter:card' },
  { attr: 'name', key: 'twitter:title' },
  { attr: 'name', key: 'twitter:description' },
  { attr: 'name', key: 'twitter:image' },
  { attr: 'name', key: 'twitter:image:alt' },
  { attr: 'name', key: 'twitter:url' },
  { attr: 'name', key: 'twitter:creator' },
  { attr: 'name', key: 'twitter:site' },
  { attr: 'name', key: 'twitter:domain' }
];

const LINK_TARGETS = [{ rel: 'canonical' }];

const DEFAULT_META = {
  title: 'getty',
  description: 'The platform tools for live streaming on Odysee. This includes overlays, tip alerts, chat, sweepstakes system, creator analytics and much more.',
  keywords: 'getty, Odysee, arweave, livestreaming, streamers, tip notifications, tip goals, chat widget, streaming, creator tools',
  canonical: 'https://app.getty.sh/',
  siteName: 'getty',
  ogType: 'website',
  locale: 'en_US',
  image: 'https://xc43575rqmogbtegwxry2rk4hkctslkb63os6y2cdq25nfkgmguq.arweave.net/uLm-_7GDHGDMhrXjjUVcOoU5LUH23S9jQhw11pVGYak',
  imageAlt: 'getty',
  imageType: 'image/png',
  imageWidth: '512',
  imageHeight: '512',
  twitterCard: 'summary_large_image',
  twitterCreator: '@getty_sh',
  twitterSite: '@getty_sh'
};

function getHeadElement() {
  if (typeof document === 'undefined') return null;
  return document.head || null;
}

function queryMeta(head, attr, key) {
  return head.querySelector(`meta[${attr}="${key}"]`);
}

function ensureMeta(head, attr, key) {
  let el = queryMeta(head, attr, key);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    head.appendChild(el);
  }
  return el;
}

function removeMeta(head, attr, key) {
  const el = queryMeta(head, attr, key);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function ensureLink(head, rel) {
  let link = head.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    head.appendChild(link);
  }
  return link;
}

function removeLink(head, rel) {
  const link = head.querySelector(`link[rel="${rel}"]`);
  if (link && link.parentNode) {
    link.parentNode.removeChild(link);
  }
}

function captureState(head) {
  const metaState = new Map();
  for (const target of META_TARGETS) {
    const el = queryMeta(head, target.attr, target.key);
    metaState.set(`${target.attr}:${target.key}`, el ? el.getAttribute('content') ?? '' : null);
  }

  const linkState = new Map();
  for (const target of LINK_TARGETS) {
    const link = head.querySelector(`link[rel="${target.rel}"]`);
    linkState.set(target.rel, link ? link.getAttribute('href') || '' : null);
  }

  return { metaState, linkState, title: typeof document !== 'undefined' ? document.title : '' };
}

function restoreState(head, state) {
  for (const target of META_TARGETS) {
    const key = `${target.attr}:${target.key}`;
    const original = state.metaState.get(key);
    if (original == null || original === '') {
      removeMeta(head, target.attr, target.key);
    } else {
      const el = ensureMeta(head, target.attr, target.key);
      if (el.getAttribute('content') !== original) {
        el.setAttribute('content', original);
      }
    }
  }

  for (const target of LINK_TARGETS) {
    const original = state.linkState.get(target.rel);
    if (original == null || original === '') {
      removeLink(head, target.rel);
    } else {
      const link = ensureLink(head, target.rel);
      if (link.getAttribute('href') !== original) {
        link.setAttribute('href', original);
      }
    }
  }

  if (typeof document !== 'undefined' && document.title !== state.title) {
    document.title = state.title;
  }
}

function deriveTwitterDomain(meta) {
  if (meta.twitterDomain) return meta.twitterDomain;
  try {
    if (meta.canonical) {
      const url = new URL(meta.canonical);
      return url.hostname || '';
    }
  } catch {}
  return '';
}

export function applyBaseSeo(overrides = {}) {
  const head = getHeadElement();
  if (!head) return () => {};
  const state = captureState(head);
  const meta = { ...DEFAULT_META, ...overrides };
  const twitterDomain = deriveTwitterDomain(meta);

  if (typeof document !== 'undefined') {
    document.title = meta.title;
  }

  const pairs = [
    { attr: 'name', key: 'description', value: meta.description },
    { attr: 'name', key: 'keywords', value: meta.keywords },
    { attr: 'property', key: 'og:title', value: meta.title },
    { attr: 'property', key: 'og:description', value: meta.description },
    { attr: 'property', key: 'og:url', value: meta.canonical },
    { attr: 'property', key: 'og:type', value: meta.ogType },
    { attr: 'property', key: 'og:site_name', value: meta.siteName },
    { attr: 'property', key: 'og:locale', value: meta.locale },
    { attr: 'property', key: 'og:image', value: meta.image },
    { attr: 'property', key: 'og:image:alt', value: meta.imageAlt },
    { attr: 'property', key: 'og:image:secure_url', value: meta.image },
    { attr: 'property', key: 'og:image:type', value: meta.imageType },
    { attr: 'property', key: 'og:image:width', value: meta.imageWidth },
    { attr: 'property', key: 'og:image:height', value: meta.imageHeight },
    { attr: 'name', key: 'twitter:card', value: meta.twitterCard },
    { attr: 'name', key: 'twitter:title', value: meta.title },
    { attr: 'name', key: 'twitter:description', value: meta.description },
    { attr: 'name', key: 'twitter:image', value: meta.image },
    { attr: 'name', key: 'twitter:image:alt', value: meta.imageAlt },
    { attr: 'name', key: 'twitter:url', value: meta.canonical },
    { attr: 'name', key: 'twitter:creator', value: meta.twitterCreator },
    { attr: 'name', key: 'twitter:site', value: meta.twitterSite },
    { attr: 'name', key: 'twitter:domain', value: twitterDomain }
  ];

  for (const { attr, key, value } of pairs) {
    if (!value) {
      removeMeta(head, attr, key);
      continue;
    }
    const el = ensureMeta(head, attr, key);
    if (el.getAttribute('content') !== value) {
      el.setAttribute('content', value);
    }
  }

  if (meta.canonical) {
    const link = ensureLink(head, 'canonical');
    if (link.getAttribute('href') !== meta.canonical) {
      link.setAttribute('href', meta.canonical);
    }
  } else {
    removeLink(head, 'canonical');
  }

  return () => {
    const latestHead = getHeadElement();
    if (latestHead) {
      restoreState(latestHead, state);
    }
  };
}

export { DEFAULT_META };
