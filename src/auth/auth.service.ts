import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtPayload, LoginResult } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { verifyPassword } from './password.js';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$KOnTWWN1uZ8jGpKPnu+S/Q$rst/1TWweiC+6xMhVHSUodvLDVKf7geTwaEor+z9vDI';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResult> {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      await verifyPassword(DUMMY_PASSWORD_HASH, loginDto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = await verifyPassword(
      user.passwordHash,
      loginDto.password,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.configService.getOrThrow<number>(
        'JWT_EXPIRES_IN_SECONDS',
      ),
      role: user.role,
    };
  }
}
