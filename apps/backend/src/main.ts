import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { json, urlencoded } from 'express';
import { PrismaService } from './prisma.service';
import { startMainAppDashboardTelemetry } from './common/dashboard/runtime-tracker';
import { timingSafeEqual } from 'crypto';
import { requireEnv } from './common/config/env';

function isValidSecret(input: string | string[] | undefined, expected: string) {
  if (typeof input !== 'string') {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  return (
    inputBuffer.length === expectedBuffer.length &&
    timingSafeEqual(inputBuffer, expectedBuffer)
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, 
  });

  app.setGlobalPrefix('api', {
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });


  // --- Body Parser Limit (larger for /bins + mail endpoint) ---
  app.use((req, res, next) => {
    if (!req.originalUrl.startsWith('/api/v1/mail/incoming')) {
      next();
      return;
    }

    if (!isValidSecret(req.headers['x-redbox-webhook-secret'], requireEnv('MAIL_WEBHOOK_SECRET'))) {
      res.status(401).json({
        status: 'Error',
        message: 'Invalid Webhook Secret',
        result: null,
      });
      return;
    }

    next();
  });

  app.use((req, res, next) => {
    // Cloudflare Incoming Mail (max 25MB Mail + JSON Overhead = ~35MB)
    if (req.originalUrl.startsWith('/api/v1/mail/incoming')) {
      json({ limit: '50mb' })(req, res, next);
    } 
    // Pastebin / Bins
    else if (req.originalUrl.startsWith('/api/v1/bins')) {
      json({ limit: '3mb' })(req, res, next);
    } 
    // default limit for all other routes
    else {
      json({ limit: '100kb' })(req, res, next);
    }
  });
  
  app.use(urlencoded({ extended: true, limit: '100kb' }));

  // --- End of Body Parser Limit ---


  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());


  const cors = {
    origin: [process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['Content-Disposition'], 
  };

  app.enableCors(cors);

  const port = process.env.PORT ??   3000;
  await app.listen(port);
  await startMainAppDashboardTelemetry(app.get(PrismaService));
  
  console.log(`Backend running on port:${port}`);
}
bootstrap();
