import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { TrialClaims, type TrialClaimStore } from './trial-claims';

const claimsWith = (secret: string) =>
  new TrialClaims({
    get: () => secret,
  } as unknown as ConfigService<Env, true>);

const SECRET = 'a'.repeat(40);

describe('TrialClaims', () => {
  const findUnique = jest.fn();
  const createMany = jest.fn();
  const db = { trialClaim: { findUnique, createMany } } as TrialClaimStore;

  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue(null);
    createMany.mockReset().mockResolvedValue({ count: 1 });
  });

  describe('keyOf', () => {
    it('is the same for every spelling of one mailbox', () => {
      const claims = claimsWith(SECRET);

      expect(claims.keyOf('First.Last+a@gmail.com')).toBe(
        claims.keyOf('firstlast@googlemail.com'),
      );
    });

    it('differs between mailboxes', () => {
      const claims = claimsWith(SECRET);

      expect(claims.keyOf('one@example.com')).not.toBe(
        claims.keyOf('two@example.com'),
      );
    });

    it('depends on the secret, so the table alone cannot be tested against known addresses', () => {
      expect(claimsWith(SECRET).keyOf('one@example.com')).not.toBe(
        claimsWith('b'.repeat(40)).keyOf('one@example.com'),
      );
    });

    it('is a url safe digest that shows nothing of the address', () => {
      expect(claimsWith(SECRET).keyOf('one@example.com')).toMatch(
        /^[A-Za-z0-9_-]{43}$/,
      );
    });
  });

  describe('isClaimed', () => {
    it('looks the mailbox up by its key', async () => {
      const claims = claimsWith(SECRET);

      await claims.isClaimed(db, 'one+x@example.com');

      expect(findUnique).toHaveBeenCalledWith({
        where: { key: claims.keyOf('one@example.com') },
      });
    });

    it('answers whether a row came back', async () => {
      const claims = claimsWith(SECRET);
      findUnique.mockResolvedValueOnce({ key: 'k' });

      await expect(claims.isClaimed(db, 'one@example.com')).resolves.toBe(true);
      await expect(claims.isClaimed(db, 'one@example.com')).resolves.toBe(
        false,
      );
    });
  });

  describe('claim', () => {
    it('wins when the insert wrote the row', async () => {
      await expect(
        claimsWith(SECRET).claim(db, 'one@example.com'),
      ).resolves.toBe(true);
    });

    it('loses when the mailbox was already there', async () => {
      createMany.mockResolvedValue({ count: 0 });

      await expect(
        claimsWith(SECRET).claim(db, 'one@example.com'),
      ).resolves.toBe(false);
    });

    it('inserts and skips duplicates in one statement, so two requests cannot both win', async () => {
      const claims = claimsWith(SECRET);

      await claims.claim(db, 'one@example.com');

      expect(createMany).toHaveBeenCalledWith({
        data: [{ key: claims.keyOf('one@example.com') }],
        skipDuplicates: true,
      });
    });
  });

  describe('claimAll', () => {
    it('answers how many mailboxes were new', async () => {
      createMany.mockResolvedValue({ count: 2 });

      await expect(
        claimsWith(SECRET).claimAll(db, ['a@example.com', 'b@example.com']),
      ).resolves.toBe(2);
    });
  });
});
