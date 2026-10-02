import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ONLY, IS_PUBLIC } from './public.decorator';

export const SESSION_COOKIE = 'ap_session';
export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

type Who = { kind: 'session' } | { kind: 'key'; canWrite: boolean };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const who = (await this.fromSession(req)) ?? (await this.fromKey(req));
    if (!who) throw new UnauthorizedException();

    if (this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY, targets) && who.kind !== 'session') {
      throw new ForbiddenException('Only the admin login can do this.');
    }
    const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (!isRead && who.kind === 'key' && !who.canWrite) {
      throw new ForbiddenException('This API key is read-only.');
    }
    return true;
  }

  private async fromSession(req: Request): Promise<Who | null> {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return null;
    try {
      await this.jwt.verifyAsync(token);
      return { kind: 'session' };
    } catch {
      return null;
    }
  }

  private async fromKey(req: Request): Promise<Who | null> {
    const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const raw = (req.headers['x-api-key'] as string | undefined) ?? bearer;
    if (!raw) return null;
    const key = await this.prisma.apiKey.findUnique({ where: { hash: hashKey(raw) } });
    if (!key || key.revokedAt) return null;
    // Only touch the row about once a minute so that reads do not turn into writes.
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
      await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    }
    return { kind: 'key', canWrite: key.canWrite };
  }
}
