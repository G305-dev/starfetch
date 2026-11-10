import { BadRequestException } from '@nestjs/common';
import { CorporateDetailsUpdateDto, canonicalizeCorporateDetailsPatch } from './corporate-details-update.input';

describe('canonicalizeCorporateDetailsPatch', () => {
  it('normalizes the allowed fields and canonicalizes date/email', () => {
    expect(canonicalizeCorporateDetailsPatch({
      institutionName: '  Example Holdings Ltd  ',
      dateOfIncorporation: '2020-02-29',
      businessEmail: '  Business@Example.Invalid  ',
    })).toEqual({
      institutionName: 'Example Holdings Ltd',
      dateOfIncorporation: new Date('2020-02-29T00:00:00.000Z'),
      businessEmail: 'business@example.invalid',
    });
  });

  it('treats enumerable undefined DTO properties as absent in a partial patch', () => {
    const dto = Object.assign(new CorporateDetailsUpdateDto(), { institutionName: 'Synthetic Revised Ltd' });
    expect(canonicalizeCorporateDetailsPatch(dto)).toEqual({ institutionName: 'Synthetic Revised Ltd' });
  });

  it('keeps the permitted TIN value transiently for the encryption boundary', () => {
    expect(canonicalizeCorporateDetailsPatch({ taxIdentificationNumber: '  SYNTHETIC-NOT-A-REAL-TIN  ' }))
      .toEqual({ taxIdentificationNumber: 'SYNTHETIC-NOT-A-REAL-TIN' });
  });

  it('accepts a TIN update and rejects an empty patch, unknown fields, and invalid values', () => {
    for (const input of [
      {},
      { unknownField: 'not-allowed' },
      { institutionName: '   ' },
      { dateOfIncorporation: '2021-02-29' },
      { businessEmail: 'not-an-email' },
      { institutionName: 'x'.repeat(256) },
      { rcNumber: 'x'.repeat(256) },
      { businessPhoneNumber: 'x'.repeat(65) },
      { taxIdentificationNumber: 'x'.repeat(257) },
    ]) {
      expect(() => canonicalizeCorporateDetailsPatch(input as any)).toThrow(BadRequestException);
    }
  });
});
