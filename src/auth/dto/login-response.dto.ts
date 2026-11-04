import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/enums.js';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Signed JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.signature',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Authorization scheme expected on protected endpoints',
    example: 'Bearer',
  })
  tokenType!: string;

  @ApiProperty({
    description: 'Access token lifetime in seconds',
    example: 3600,
  })
  expiresIn!: number;

  @ApiProperty({
    description: 'Role assigned to the authenticated user',
    enum: UserRole,
    example: UserRole.USER,
  })
  role!: UserRole;
}
