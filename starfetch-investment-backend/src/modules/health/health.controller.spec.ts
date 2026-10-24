import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => (key === 'api.version' ? '0.0.1' : undefined)),
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns a safe ok payload with a version', () => {
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(typeof result.version).toBe('string');
    expect(Object.keys(result).sort()).toEqual(['status', 'version']);
  });

  it('never exposes secrets or internals', () => {
    const serialized = JSON.stringify(controller.getHealth());
    expect(serialized).not.toMatch(/password|secret|token|DATABASE_URL|postgres/i);
  });
});
