import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { PasswordService } from './password.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAuthGuard],
  // JwtModule is re-exported too: any module that imports AuthModule to use
  // JwtAuthGuard (e.g. ProductsModule) needs JwtService resolvable in its own
  // scope, since @UseGuards(JwtAuthGuard) resolves the guard's dependencies
  // in the *consuming* module's context, not AuthModule's.
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
