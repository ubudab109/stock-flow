import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@eterna/shared';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
