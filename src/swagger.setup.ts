import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Student Management API')
    .setDescription(
      'REST API for authenticating users and managing students. Obtain a JWT access token from POST /auth/login and send it as a Bearer token on protected endpoints.',
    )
    .setVersion('1.0')
    .addTag('Auth')
    .addTag('Students')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT access token obtained from POST /auth/login',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
