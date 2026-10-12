import { acceptPathFor } from './invite-link';

describe('acceptPathFor', () => {
  it.each([
    { delivered: true, canEmail: true, registrationOpen: true, token: false },
    { delivered: true, canEmail: true, registrationOpen: false, token: false },
    { delivered: false, canEmail: true, registrationOpen: true, token: false },
    { delivered: false, canEmail: true, registrationOpen: false, token: true },
    { delivered: false, canEmail: false, registrationOpen: true, token: true },
    { delivered: false, canEmail: false, registrationOpen: false, token: true },
  ])(
    'carries the token $token when delivered=$delivered canEmail=$canEmail registrationOpen=$registrationOpen',
    ({ token, ...delivery }) => {
      const path = acceptPathFor('secret-token', delivery);

      expect(path).toBe(token ? '/invite?token=secret-token' : '/invite');
    },
  );
});
