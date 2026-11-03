import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthenticatedUser, JwtPayload } from '../auth.types.js';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Invalid or expired token');
      }

      request.user = { id: payload.sub, email: payload.email };
      return true;
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
