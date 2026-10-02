import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import { createHash, timingSafeEqual } from 'crypto';
import type { Response } from 'express';
import { SESSION_COOKIE } from './auth.guard';
import { Public } from './public.decorator';

class LoginDto {
  @IsString() @MaxLength(200) password: string;
}

const sha = (s: string) => createHash('sha256').update(s).digest();

@Controller('auth')
export class AuthController {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService) {}

  // 10 tries per minute per IP, to make guessing the password slow.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    // Hash both sides first so timingSafeEqual gets equal-length buffers and timing leaks nothing.
    const ok = timingSafeEqual(sha(dto.password), sha(this.config.getOrThrow<string>('ADMIN_PASSWORD')));
    if (!ok) {
      res.status(401);
      return { ok: false, message: 'Wrong password' };
    }
    const token = await this.jwt.signAsync({ role: 'admin' });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE') === 'true',
      maxAge: 7 * 24 * 3600 * 1000,
      path: '/',
    });
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Any authenticated caller gets 200; the web app uses this to check if it is logged in. */
  @Get('me')
  me() {
    return { ok: true };
  }
}
