import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ConfigModule has loaded .env by now, so check the required values here.
  for (const key of ['ADMIN_PASSWORD', 'JWT_SECRET', 'DATABASE_URL']) {
    if (!process.env[key]) throw new Error(`Missing ${key}. Set it in .env (see .env.example).`);
  }
  app.use(helmet());
  app.use(cookieParser());
  // whitelist drops unknown fields; transform turns query strings into numbers/booleans.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on :${port}`);
}
bootstrap();
