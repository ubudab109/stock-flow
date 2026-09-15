import { Injectable } from '@nestjs/common';
import { compare, hash, hashSync } from 'bcryptjs';

const SALT_ROUNDS = 12;

// A structurally valid bcrypt hash that doesn't correspond to any real
// password. Comparing against it when a login email isn't found keeps the
// request's timing similar to a real failed-password check, so a wrong
// email and a wrong password aren't distinguishable from response timing.
const DUMMY_HASH = hashSync('no-such-user-dummy-comparison', SALT_ROUNDS);

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, SALT_ROUNDS);
  }

  compare(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }

  compareDummy(plain: string): Promise<boolean> {
    return compare(plain, DUMMY_HASH);
  }
}
