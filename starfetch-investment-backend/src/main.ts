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
    `Starfetch API — Phase 2A foundation listening on port ${port}. ` +
      `Authentication and business endpoints are intentionally NOT implemented in this phase.`,
  );
}

void bootstrap();
