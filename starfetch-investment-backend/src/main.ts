import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');

  new Logger('Bootstrap').log(
    `Starfetch API — Phase 2B authentication & identity listening on port ${port}. ` +
      `Business surfaces beyond auth/identity remain intentionally NOT implemented.`,
  );
}

void bootstrap();
