import { Logger } from '@nestjs/common';
import { Env } from './env';

const IMPLICIT_TLS_PORT = 465;

const SANDBOX_KEY_PREFIXES = ['sk_test_', 'rk_test_'];

const PUBLISHABLE_KEY_MODES = { pk_test_: 'test', pk_live_: 'live' } as const;

const LOOPBACK_HOST =
  /^(?:localhost|.+\.localhost|127(?:\.\d{1,3}){3}|\[::1\])$/;

const logger = new Logger('ProductionSafety');

export function assertProductionSafety(env: Env): void {
  if (env.BILLING_ENABLED && env.TRIAL_DAYS < 1) {
    throw new Error(
      'TRIAL_DAYS must be at least 1 when BILLING_ENABLED is true. It is the length of the Stripe trial every new account is offered at checkout, and Stripe refuses a trial shorter than a day.',
    );
  }

  if (env.BILLING_ENABLED && mailConfigured(env) && !env.WEB_PUBLIC_URL) {
    throw new Error(
      'WEB_PUBLIC_URL must be set when BILLING_ENABLED is true and SMTP is configured. Email confirmation is mandatory in that combination, and the confirmation link would carry no host, so no new account could ever be confirmed.',
    );
  }

  if (env.WEBHOOK_ALLOW_PRIVATE_TARGETS && env.BILLING_ENABLED) {
    throw new Error(
      'WEBHOOK_ALLOW_PRIVATE_TARGETS must be false when BILLING_ENABLED is true. Hosted registration gives every customer their own workspace, and a webhook is a url they choose, so allowing private targets lets any of them make this server read your internal network and the cloud metadata service. The opt-in exists for a single-tenant self-hosted instance delivering to its own LAN.',
    );
  }

  if (env.AUTH_REGISTRATION_WORKSPACE === 'shared' && env.BILLING_ENABLED) {
    throw new Error(
      'AUTH_REGISTRATION_WORKSPACE must be own when BILLING_ENABLED is true. Hosted registration is open to strangers, and shared would drop every one of them into the bootstrap workspace with read and write access to the apps, keywords and rankings already tracked there. The shared opt-in exists for a self-hosted instance whose sign ups are all people already trusted with that data.',
    );
  }

  assertOneTaxCollector(env);
  assertOneStripeAccount(env);

  if (env.PROXY_PROVIDER !== 'none' && !env.PROXY_API_KEY) {
    throw new Error(
      `PROXY_PROVIDER is ${env.PROXY_PROVIDER} but PROXY_API_KEY is empty. The pool would never receive an endpoint and every store request would keep leaving from the host address. Set PROXY_API_KEY, or set PROXY_PROVIDER=none.`,
    );
  }

  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (!env.AUTH_COOKIE_SECURE) {
    throw new Error(
      'AUTH_COOKIE_SECURE must be true when NODE_ENV is production. Session cookies would otherwise be sent over plain HTTP. Keep it true and serve the web app over HTTPS.',
    );
  }

  for (const warning of productionWarnings(env)) {
    logger.warn(warning);
  }
}

export function productionWarnings(env: Env): string[] {
  if (env.NODE_ENV !== 'production') {
    return [];
  }

  const warnings: string[] = [];

  if (env.TRUST_PROXY === 0) {
    warnings.push(
      'TRUST_PROXY is 0 in production. Authentication throttling keys on the connecting address, so behind a reverse proxy every client shares one bucket. Set TRUST_PROXY to the number of proxies you control between the internet and the API, counting the web app as one. Counting a hop you do not control lets any client spoof X-Forwarded-For and bypass throttling entirely.',
    );
  }

  if (env.WEBHOOK_ALLOW_PRIVATE_TARGETS) {
    warnings.push(
      'WEBHOOK_ALLOW_PRIVATE_TARGETS is true in production. Alert webhooks may reach loopback, private and link-local addresses, so anyone who can register a webhook can make this server request internal services on their behalf. Leave it false unless every account on this instance is already trusted with the whole network.',
    );
  }

  if (env.ALERT_DELIVERY === 'instant' && !mailConfigured(env)) {
    warnings.push(
      'ALERT_DELIVERY is instant but SMTP_HOST and SMTP_FROM are not both set. Email alerts are generated and then discarded. Configure SMTP, or add a webhook subscription, or set ALERT_DELIVERY=batched.',
    );
  }

  if (mailConfigured(env) && !env.WEB_PUBLIC_URL) {
    warnings.push(
      'SMTP is configured in production with no WEB_PUBLIC_URL. A confirmation email needs a link to the web app, so no new email alert recipient can be asked to confirm and none of them receives an alert, and alert emails go out with no unsubscribe link. Set WEB_PUBLIC_URL to the origin the web app is served from.',
    );
  }

  if (
    mailConfigured(env) &&
    env.WEB_PUBLIC_URL &&
    LOOPBACK_HOST.test(new URL(env.WEB_PUBLIC_URL).hostname)
  ) {
    warnings.push(
      `WEB_PUBLIC_URL is ${env.WEB_PUBLIC_URL} in production. Every link in an email points at this machine, so a recipient anywhere else cannot open it. Set WEB_PUBLIC_URL to the origin a person would type. The Compose stacks read it from the root .env, not from apps/api/.env.`,
    );
  }

  if (
    mailConfigured(env) &&
    env.SMTP_SECURE &&
    env.SMTP_PORT !== IMPLICIT_TLS_PORT
  ) {
    warnings.push(
      `SMTP_SECURE is true with SMTP_PORT ${env.SMTP_PORT}. Implicit TLS is port ${IMPLICIT_TLS_PORT}; ports 587 and 25 expect STARTTLS, so the connection will usually hang or be refused. Use port ${IMPLICIT_TLS_PORT}, or set SMTP_SECURE=false.`,
    );
  }

  if (
    env.AUTH_ALLOW_REGISTRATION &&
    env.AUTH_REGISTRATION_WORKSPACE === 'shared'
  ) {
    warnings.push(
      'AUTH_ALLOW_REGISTRATION is true in production with AUTH_REGISTRATION_WORKSPACE shared. Anyone who registers joins the bootstrap workspace as a member, so they see and can edit every tracked app, keyword and ranking in it. Close registration, or drop the shared opt-in so each sign up gets a workspace of its own and invite teammates from settings instead.',
    );
  }

  if (
    env.OPENAI_API_KEY &&
    env.AUTH_ALLOW_REGISTRATION &&
    !env.BILLING_ENABLED &&
    env.AI_CALLS_PER_MONTH === null
  ) {
    warnings.push(
      'OPENAI_API_KEY is set on a self hosted instance with open registration and no AI_CALLS_PER_MONTH. Every account that registers can make unlimited AI calls on your OpenAI key. Set AI_CALLS_PER_MONTH to the calls each workspace may make per month, or close registration with AUTH_ALLOW_REGISTRATION=false.',
    );
  }

  if (env.BILLING_ENABLED && !mailConfigured(env)) {
    warnings.push(
      `BILLING_ENABLED is true in production but SMTP_HOST and SMTP_FROM are not both set${missingHalf(env)}. This instance cannot send a single account email: nobody can confirm an address; nobody is warned before a trial ends, so customers are locked out without notice; and nobody who forgets a password can recover the account without you editing the database. Configure SMTP, or set BILLING_ENABLED=false.`,
    );
  }

  warnings.push(...stripeWarnings(env));

  if (env.ERROR_TRACKING_DSN && !env.BILLING_ENABLED) {
    warnings.push(
      'ERROR_TRACKING_DSN is set with BILLING_ENABLED false. Error tracking stays off, because a self hosted deployment never reports its errors to anyone else. Remove the dsn, or set BILLING_ENABLED=true if this is the hosted service.',
    );
  }

  if (env.API_DOCS === 'public') {
    warnings.push(
      'API_DOCS is public in production. The whole OpenAPI surface is served to anonymous callers. Set API_DOCS=owner to require a session or an asob_ token, or off to stop registering the routes.',
    );
  }

  return warnings;
}

function assertOneTaxCollector(env: Env): void {
  if (env.STRIPE_MANAGED_PAYMENTS && env.STRIPE_TAX_ENABLED) {
    throw new Error(
      'STRIPE_MANAGED_PAYMENTS and STRIPE_TAX_ENABLED cannot both be true. Under Managed Payments Stripe is the merchant of record and applies its own tax to every checkout session, so STRIPE_TAX_ENABLED, which says this business collects the tax under its own registrations, contradicts it. Keep STRIPE_MANAGED_PAYMENTS and set STRIPE_TAX_ENABLED=false.',
    );
  }
}

function assertOneStripeAccount(env: Env): void {
  if (!env.STRIPE_PUBLISHABLE_KEY || !env.STRIPE_SECRET_KEY) return;
  const publishable = publishableModeOf(env.STRIPE_PUBLISHABLE_KEY);
  const secret = isSandboxKey(env.STRIPE_SECRET_KEY) ? 'test' : 'live';
  if (publishable === secret) return;
  throw new Error(
    `STRIPE_PUBLISHABLE_KEY is a ${publishable ?? 'unrecognised'} key but STRIPE_SECRET_KEY is a ${secret} key. The billing wall would mount Checkout against another account than the one that creates its sessions. Use the publishable key of the same Stripe account and mode, or clear STRIPE_PUBLISHABLE_KEY to keep the hosted Checkout redirect.`,
  );
}

function publishableModeOf(key: string): 'test' | 'live' | null {
  const prefix = Object.keys(PUBLISHABLE_KEY_MODES).find((candidate) =>
    key.startsWith(candidate),
  ) as keyof typeof PUBLISHABLE_KEY_MODES | undefined;
  return prefix ? PUBLISHABLE_KEY_MODES[prefix] : null;
}

function stripeWarnings(env: Env): string[] {
  const warnings: string[] = [];

  if (env.STRIPE_PUBLISHABLE_KEY && !env.STRIPE_SECRET_KEY) {
    warnings.push(
      'STRIPE_PUBLISHABLE_KEY is set but STRIPE_SECRET_KEY is not, so the wall cannot open a session. Set both, or clear STRIPE_PUBLISHABLE_KEY to keep the hosted Checkout redirect.',
    );
  }

  if (env.BILLING_ENABLED && !env.STRIPE_SECRET_KEY) {
    warnings.push(
      'BILLING_ENABLED is true in production with no STRIPE_SECRET_KEY. No account can start a trial or pay, because both need Checkout. Configure Stripe, or leave billing off.',
    );
  }

  if (env.BILLING_ENABLED && isSandboxKey(env.STRIPE_SECRET_KEY)) {
    warnings.push(
      'BILLING_ENABLED is true in production on a sandbox STRIPE_SECRET_KEY. Every environment that shares this sandbox posts its events to this endpoint, so give each environment its own sandbox, and switch to a live key before a customer pays.',
    );
  }

  if (
    env.BILLING_ENABLED &&
    env.STRIPE_SECRET_KEY &&
    !isSandboxKey(env.STRIPE_SECRET_KEY) &&
    !env.STRIPE_TAX_ENABLED &&
    !env.STRIPE_MANAGED_PAYMENTS
  ) {
    warnings.push(
      'BILLING_ENABLED is true in production on a live STRIPE_SECRET_KEY with neither STRIPE_MANAGED_PAYMENTS nor STRIPE_TAX_ENABLED. Every checkout sells without tax, and this business stays liable for it. Set STRIPE_MANAGED_PAYMENTS=true to make Stripe the merchant of record, or register for tax and set STRIPE_TAX_ENABLED=true.',
    );
  }

  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
    warnings.push(
      'STRIPE_SECRET_KEY is set in production with no STRIPE_WEBHOOK_SECRET. Every webhook delivery is refused, so a paid subscription never provisions access. Checkout stays closed until both are set.',
    );
  }

  if (env.STRIPE_SECRET_KEY && !env.WEB_PUBLIC_URL) {
    warnings.push(
      'STRIPE_SECRET_KEY is set in production with no WEB_PUBLIC_URL. Stripe has nowhere to return a customer to after checkout, so checkout stays closed until it is set.',
    );
  }

  return warnings;
}

function missingHalf(env: Env): string {
  if (env.SMTP_HOST) return ', because SMTP_FROM is empty';
  if (env.SMTP_FROM) return ', because SMTP_HOST is empty';
  return '';
}

function mailConfigured(env: Env): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

function isSandboxKey(key: string | undefined): boolean {
  return SANDBOX_KEY_PREFIXES.some((prefix) => key?.startsWith(prefix));
}
