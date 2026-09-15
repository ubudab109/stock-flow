import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { AppConfig } from '../../config/configuration.js';

/**
 * Skips rate limiting entirely in the test environment. Our e2e suite logs
 * in many times per run (once per test file's `registerAndLogin` call) —
 * without this, the login endpoint's 5-per-minute limit would fail
 * unrelated tests with 429s instead of the status codes they're actually
 * asserting on.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    super(options, storageService, reflector);
  }

  canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.config.get('nodeEnv', { infer: true }) === 'test') {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }
}
