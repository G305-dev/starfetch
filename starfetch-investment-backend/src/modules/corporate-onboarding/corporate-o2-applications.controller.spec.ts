import 'reflect-metadata';
import { KEYED_RATE_LIMIT_KEY } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { RATE_LIMIT_KEY } from '../../common/rate-limit/rate-limit.decorator';
import { CorporateO2ApplicationsController } from './corporate-o2-applications.controller';

describe('CorporateO2ApplicationsController rate-limit policy', () => {
  const handler = CorporateO2ApplicationsController.prototype.create;

  it('applies the reviewed 5-create-per-hour authenticated-user limit', () => {
    expect(Reflect.getMetadata(KEYED_RATE_LIMIT_KEY, handler)).toEqual({
      bucket: 'corporate-o2-create',
      limit: 5,
      windowSeconds: 3600,
      identity: 'user',
    });
  });

  it('does not claim a separate IP tier that is not configured for O2', () => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler)).toBeUndefined();
  });
});
