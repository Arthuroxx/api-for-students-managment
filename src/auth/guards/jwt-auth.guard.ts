import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthenticatedUser, JwtPayload } from '../auth.types.js';
import { isUserRole } from '../user-role.js';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const payload = await this.verifyToken(token);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // The database is the source of truth for the role. A token issued before
    // a role change cannot keep permissions the user no longer has.
    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return true;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (
        !payload.sub ||
        typeof payload.sub !== 'string' ||
        !isUserRole(payload.role)
      ) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const match = /^Bearer\s+(\S+)$/i.exec(authorization);

    return match?.[1];
  }
}
