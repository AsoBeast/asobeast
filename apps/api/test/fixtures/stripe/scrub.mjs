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
  `\\b(${PREFIXES.join('|')})_((?:test|live)_)?([A-Za-z0-9]+)`,
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

  const scrubbed = JSON.parse(replaced.replace(EMAIL, 'owner@example.com'));
  return `${JSON.stringify(scrubbed, null, 2)}\n`;
}

process.stdout.write(scrub(readFileSync(0, 'utf8')));
