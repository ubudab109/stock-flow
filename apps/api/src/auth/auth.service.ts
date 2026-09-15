import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import ms from 'ms';
import type { AppConfig } from '../config/configuration.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { JwtPayload } from './interfaces/jwt-payload.interface.js';
import { PasswordService } from './password.service.js';

export interface PublicUser {
  id: string;
  email: string;
}

export interface LoginResult {
  user: PublicUser;
  accessToken: string;
  expiresAt: Date;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const email = normalizeEmail(dto.email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    return { id: user.id, email: user.email };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Run a comparison of matching cost even when there's no user, so a
      // wrong email and a wrong password take the same amount of time.
      await this.passwordService.compareDummy(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await this.passwordService.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const expiresInMs = ms(this.config.get('jwtExpiresIn', { infer: true }) as ms.StringValue);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const session = await this.prisma.session.create({
      data: { userId: user.id, expiresAt },
    });

    const payload: JwtPayload = { sub: user.id, sid: session.id };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwtSecret', { infer: true }),
      expiresIn: this.config.get('jwtExpiresIn', { infer: true }),
    });

    return { user: { id: user.id, email: user.email }, accessToken, expiresAt };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
