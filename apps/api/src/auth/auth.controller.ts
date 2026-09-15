import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AppConfig } from '../config/configuration.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthService, type PublicUser } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ACCESS_TOKEN_COOKIE, JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  // Stricter than the global default: 5 attempts per minute per IP, to slow
  // down credential-stuffing / brute-force attempts against this endpoint
  // specifically.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser }> {
    const { user, accessToken, expiresAt } = await this.authService.login(dto);

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      // Tied to whether the frontend origin is actually HTTPS, not NODE_ENV
      // — a `Secure` cookie is silently dropped by real browsers over plain
      // HTTP, which is exactly how the bonus docker-compose deployment (a
      // "production" NODE_ENV, but no TLS) serves the app.
      secure: this.config.get('webOrigin', { infer: true }).startsWith('https://'),
      expires: expiresAt,
      path: '/',
    });

    return { user };
  }

  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(currentUser.sessionId);
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  }

  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @Get('me')
  me(@CurrentUser() currentUser: AuthenticatedUser): { id: string; email: string } {
    return { id: currentUser.id, email: currentUser.email };
  }
}
