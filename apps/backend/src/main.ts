import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { json, urlencoded } from 'express';

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
    origin:['http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    exposedHeaders: ['Content-Disposition'], 
  };

  app.enableCors(cors);

  const port = process.env.PORT ??   3000;
  await app.listen(port);
  
  console.log(`Backend running on port:${port}`);
}
bootstrap();