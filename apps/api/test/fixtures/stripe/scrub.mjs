import { readFileSync } from 'node:fs';

const PREFIXES = [
  'sub_sched',
  'cus',
  'sub',
  'si',
  'in',
  'il',
  'price',
  'prod',
  'pi',
  'ch',
  'pm',
  'cs',
  'evt',
  'bps',
  'acct',
];

const ID = new RegExp(
  `\\b(${PREFIXES.join('|')})_((?:test|live)_)?([A-Za-z0-9]{14,})\\b`,
  'g',
);

const PRICE_BY_LOOKUP_KEY = {
  asobeast_indie_month: 'price_TestIndieMonthly',
  asobeast_indie_year: 'price_TestIndieYearly',
  asobeast_ultimate_month: 'price_TestUltimateMonthly',
  asobeast_ultimate_year: 'price_TestUltimateYearly',
};

const FIRST_OF = {
  cus: 'cus_TestWorkspace1',
  sub: 'sub_TestIndieMonthly',
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const OWNER_NAME = 'Test Owner';

const INVOICE_URL = 'https://invoice.stripe.test/Test';

const TAX_ID = 'TEST0000';

function blankAddress(address) {
  if (!address || typeof address !== 'object') return address;
  return Object.fromEntries(
    Object.keys(address).map((key) => [
      key,
      key === 'country' ? address[key] : null,
    ]),
  );
}

const PERSONAL = {
  address: blankAddress,
  customer_address: blankAddress,
  customer_shipping: () => null,
  shipping_details: () => null,
  customer_name: (value) => (value === null ? null : OWNER_NAME),
  customer_phone: () => null,
  phone: () => null,
  client_secret: () => null,
  idempotency_key: () => null,
  hosted_invoice_url: (value) => (value === null ? null : INVOICE_URL),
  invoice_pdf: (value) => (value === null ? null : INVOICE_URL),
  receipt_url: (value) => (value === null ? null : INVOICE_URL),
  tax_ids: (ids) =>
    Array.isArray(ids) ? ids.map((id) => ({ ...id, value: TAX_ID })) : ids,
  customer_tax_ids: (ids) =>
    Array.isArray(ids) ? ids.map((id) => ({ ...id, value: TAX_ID })) : ids,
};

function withoutPersonalData(node, parentKey = '') {
  if (Array.isArray(node)) {
    return node.map((item) => withoutPersonalData(item, parentKey));
  }
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => {
      if (parentKey === 'customer_details' && key === 'name') {
        return [key, value === null ? null : OWNER_NAME];
      }
      const blank = PERSONAL[key];
      return [key, blank ? blank(value) : withoutPersonalData(value, key)];
    }),
  );
}

function pricesByLookupKey(node, found = new Map()) {
  if (Array.isArray(node)) {
    for (const item of node) pricesByLookupKey(item, found);
    return found;
  }
  if (node && typeof node === 'object') {
    const fixed = PRICE_BY_LOOKUP_KEY[node.lookup_key];
    if (node.object === 'price' && fixed) found.set(node.id, fixed);
    for (const value of Object.values(node)) pricesByLookupKey(value, found);
  }
  return found;
}

function scrub(text) {
  const envelope = JSON.parse(text);
  if (envelope.livemode !== false) {
    throw new Error(`${envelope.id} is not a sandbox event; refusing it`);
  }

  const renamed = pricesByLookupKey(envelope);
  const counters = new Map();
  const replaced = text.replace(ID, (id, prefix, mode, rest) => {
    if (!mode && rest.startsWith('Test')) return id;
    if (!renamed.has(id)) {
      const first = FIRST_OF[prefix];
      const taken = [...renamed.values()].includes(first);
      if (first && !taken) {
        renamed.set(id, first);
      } else {
        const next = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, next);
        renamed.set(id, `${prefix}_Test${next}`);
      }
    }
    return renamed.get(id);
  });

  const scrubbed = withoutPersonalData(
    JSON.parse(replaced.replace(EMAIL, 'owner@example.com')),
  );
  return `${JSON.stringify(scrubbed, null, 2)}\n`;
}

process.stdout.write(scrub(readFileSync(0, 'utf8')));
