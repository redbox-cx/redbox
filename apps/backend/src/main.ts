import 'dotenv/config'; // <--- DIESE ZEILE MUSS GANZ OBEN STEHEN!
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kleiner Tipp für dein React-Frontend:
  // React (Vite) läuft meistens auf Port 5173, nicht 3000. 
  // Das Backend läuft auf 3000.
  const cors = {
    origin: ['http://localhost:5173'], // Hier die URL deines React-Frontends rein
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  };

  app.enableCors(cors);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`🚀 Backend läuft auf: http://localhost:${port}`);
  console.log(`📊 Datenbank-URL geladen: ${process.env.DATABASE_URL ? 'JA' : 'NEIN'}`);
}
bootstrap();