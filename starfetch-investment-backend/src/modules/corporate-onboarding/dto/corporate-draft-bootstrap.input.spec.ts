import { canonicalizeCorporateDraftBootstrap } from './corporate-draft-bootstrap.input';

describe('canonicalizeCorporateDraftBootstrap', () => {
  const valid = {
    institutionName: '  Example Holdings Ltd  ',
    dateOfIncorporation: '2020-02-29',
    rcNumber: 'RC-123',
    businessPhoneNumber: ' +2348000000000 ',
    businessEmail: ' ACCOUNTS@EXAMPLE.COM ',
  };

  it('canonicalizes the internal non-TIN fields without inventing registry policy', () => {
    expect(canonicalizeCorporateDraftBootstrap(valid)).toEqual({
      institutionName: 'Example Holdings Ltd',
      dateOfIncorporation: '2020-02-29',
      rcNumber: 'RC-123',
      businessPhoneNumber: '+2348000000000',
      businessEmail: 'accounts@example.com',
    });
  });

  it('rejects an extra tax field instead of silently dropping or persisting it', () => {
    expect(() =>
      canonicalizeCorporateDraftBootstrap({
        ...valid,
        taxIdentificationNumber: 'SYNTHETIC-NOT-A-REAL-TIN',
      } as never),
    ).toThrow();
  });

  it.each(['2023-02-29', '2020-13-01', '01-02-2020', ''])('rejects invalid incorporation date %j', (date) => {
    expect(() =>
      canonicalizeCorporateDraftBootstrap({ ...valid, dateOfIncorporation: date }),
    ).toThrow();
  });

  it('rejects an invalid email and blank required fields', () => {
    expect(() =>
      canonicalizeCorporateDraftBootstrap({ ...valid, businessEmail: 'not-an-email' }),
    ).toThrow();
    expect(() =>
      canonicalizeCorporateDraftBootstrap({ ...valid, institutionName: '   ' }),
    ).toThrow();
  });
});
