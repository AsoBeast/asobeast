const SHARED = [
  'Settings, Checkout and Payment Links, Subscriptions: limit customers to one subscription, on',
  'Settings, Billing, Subscriptions and emails: Smart Retries on, then mark the subscription unpaid',
  'Settings, Billing, Subscriptions and emails: trial end behaviour stays irrelevant, Checkout never starts a Stripe trial',
  'Developers, Webhooks: one endpoint per environment with the ten handled events on the pinned api version',
];

const SELLER = [
  'Settings, Billing, Subscriptions and emails: emails for failed payments, expiring cards and payments requiring authentication, on with the hosted invoice link',
  'Settings, Payment methods: card, Link, Apple Pay and Google Pay on; SEPA Direct Debit and Cash App Pay off',
  'Settings, Checkout: adaptive pricing off',
  'Settings, Public details: legal name, support email hello@asobeast.dev, terms and privacy urls',
  'Radar: default rules',
];

const MANAGED_PAYMENTS = [
  'Settings, Managed Payments: activated, with the Managed Payments terms accepted',
  'Settings, Business details: support email hello@asobeast.dev; Stripe escalates there and may refund on its own after 48 hours without an answer',
  'Settings, Public details: statement descriptor ASOBEAST, printed after LINK.COM* on every card statement',
  'Settings, Checkout: terms of service and privacy policy urls for the checkout footer',
  'Settings, Billing, Subscriptions and emails: emails for failed payments and expiring cards on; Link sends receipts and invoices itself',
  'Settings, Payment methods: the Managed Payments payment method configuration, with Link, cards, Apple Pay and Google Pay on',
  'Settings, Tax: no registrations; threshold monitoring on for the countries Managed Payments does not cover',
  'Settings, Billing, Invoices: legal name, address and tax id, printed on invoices for countries Managed Payments does not cover',
];

export function dashboardChecklist(managedPayments: boolean): string[] {
  return [...SHARED, ...(managedPayments ? MANAGED_PAYMENTS : SELLER)];
}
