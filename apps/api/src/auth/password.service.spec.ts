import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password to a different value than the plaintext, salted differently each time', async () => {
    const [hashA, hashB] = await Promise.all([service.hash('Passw0rd!'), service.hash('Passw0rd!')]);

    expect(hashA).not.toBe('Passw0rd!');
    expect(hashA).not.toBe(hashB);
  });

  it('accepts the correct password and rejects a wrong one', async () => {
    const hashed = await service.hash('Passw0rd!');

    await expect(service.compare('Passw0rd!', hashed)).resolves.toBe(true);
    await expect(service.compare('wrong-password', hashed)).resolves.toBe(false);
  });

  it('compareDummy always resolves false without throwing, regardless of input', async () => {
    await expect(service.compareDummy('anything')).resolves.toBe(false);
  });
});
