export const TEST_STORE_CONNECT_KEY = Buffer.alloc(32, 9).toString('base64');

process.env.STORE_CONNECT_ENCRYPTION_KEY = TEST_STORE_CONNECT_KEY;
