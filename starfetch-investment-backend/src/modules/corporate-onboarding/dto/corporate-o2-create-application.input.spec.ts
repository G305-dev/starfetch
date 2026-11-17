import { canonicalizeCorporateO2Input } from './corporate-o2-create-application.input';

const valid = {
  institutionName: ' Synthetic Example Ltd ',
  dateOfIncorporation: '2020-02-29',
  rcNumber: ' RC-SYNTHETIC-1 ',
  taxIdentificationNumber: ' SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER ',
  businessPhoneNumber: ' +2348000000000 ',
  businessEmail: '  Synthetic@Example.invalid ',
};

describe('canonicalizeCorporateO2Input', () => {
  it('canonicalizes the exact six-field payload without inferring TIN eligibility rules', () => {
    expect(canonicalizeCorporateO2Input(valid)).toEqual({
      institutionName: 'Synthetic Example Ltd',
      dateOfIncorporation: '2020-02-29',
      rcNumber: 'RC-SYNTHETIC-1',
      taxIdentificationNumber: 'SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER',
      businessPhoneNumber: '+2348000000000',
      businessEmail: 'synthetic@example.invalid',
    });
  });

  it('rejects unknown authorization fields, incomplete values, invalid dates and invalid email', () => {
    expect(() => canonicalizeCorporateO2Input({ ...valid, initiatingUserId: 'forged' })).toThrow();
    expect(() => canonicalizeCorporateO2Input({ ...valid, taxIdentificationNumber: '   ' })).toThrow();
    expect(() => canonicalizeCorporateO2Input({ ...valid, dateOfIncorporation: '2023-02-29' })).toThrow();
    expect(() => canonicalizeCorporateO2Input({ ...valid, businessEmail: 'not-an-email' })).toThrow();
  });
});
