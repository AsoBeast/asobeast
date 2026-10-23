import './enable-store-connect';

export const TEST_GOOGLE_CLIENT = {
  id: 'asobeast-test.apps.googleusercontent.com',
  secret: 'test-oauth-client-secret',
  origin: 'https://aso.example.com',
};

process.env.GOOGLE_PLAY_OAUTH_CLIENT_ID = TEST_GOOGLE_CLIENT.id;
process.env.GOOGLE_PLAY_OAUTH_CLIENT_SECRET = TEST_GOOGLE_CLIENT.secret;
process.env.WEB_PUBLIC_URL = TEST_GOOGLE_CLIENT.origin;
