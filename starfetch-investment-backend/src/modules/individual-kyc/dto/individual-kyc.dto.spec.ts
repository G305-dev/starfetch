import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BankDetailsKycSectionDto, IdDocumentUploadIntentDto, INDIVIDUAL_KYC_HORIZON_LABELS, IndividualKycInvestmentHorizon, InvestmentProfileKycSectionDto, PersonalKycSectionDto, SourceOfFundsKycSectionDto } from './individual-kyc.dto';

const strict = <T extends object>(ctor: new () => T, input: Record<string, unknown>) =>
  validateSync(plainToInstance(ctor, input), { whitelist: true, forbidNonWhitelisted: true });

describe('Individual KYC DTO boundaries', () => {
  it('rejects raw BVN and unsupported client fields', () => {
    expect(strict(PersonalKycSectionDto, { version: 0, bvn: '12345678901' }).length).toBeGreaterThan(0);
    expect(strict(BankDetailsKycSectionDto, { version: 0, branchCode: '123', sortCode: '123' }).length).toBeGreaterThan(0);
    expect(strict(PersonalKycSectionDto, { version: 0, userId: 'another-user' }).length).toBeGreaterThan(0);
  });

  it('accepts all five stable horizon codes and exposes their exact frontend labels', () => {
    const expected = {
      [IndividualKycInvestmentHorizon.DAYS_180]: '180 days',
      [IndividualKycInvestmentHorizon.DAYS_365]: '365 days',
      [IndividualKycInvestmentHorizon.YEARS_1_TO_3]: '1–3 years',
      [IndividualKycInvestmentHorizon.YEARS_3_TO_5]: '3–5 years',
      [IndividualKycInvestmentHorizon.YEARS_5_PLUS]: '5+ years',
    };
    expect(INDIVIDUAL_KYC_HORIZON_LABELS).toEqual(expected);
    for (const investmentHorizon of Object.values(IndividualKycInvestmentHorizon)) {
      expect(strict(InvestmentProfileKycSectionDto, { version: 0, investmentHorizon })).toHaveLength(0);
    }
    expect(strict(InvestmentProfileKycSectionDto, { version: 0, investmentHorizon: 'DAYS_90' }).length).toBeGreaterThan(0);
  });

  it('places annual income and estimated net worth on Investment Profile, not Source of Funds', () => {
    expect(strict(InvestmentProfileKycSectionDto, { version: 0, annualIncomeMinor: '123456', estimatedNetWorthMinor: '654321' })).toHaveLength(0);
    expect(strict(SourceOfFundsKycSectionDto, { version: 0, annualIncomeMinor: '123456', estimatedNetWorthMinor: '654321' }).length).toBeGreaterThan(0);
  });

  it('allows partial conditional PEP drafts but validates supplied nested values', () => {
    expect(strict(PersonalKycSectionDto, { version: 0, pepStatus: 'YES' })).toHaveLength(0);
    expect(strict(PersonalKycSectionDto, { version: 0, pepStatus: 'YES', pepDetails: { fullName: 'Synthetic Name' } })).toHaveLength(0);
    expect(strict(PersonalKycSectionDto, { version: 0, pepStatus: 'YES', pepDetails: { unapprovedField: 'bad' } }).length).toBeGreaterThan(0);
  });

  it('accepts only PDF/JPEG/PNG upload intents with a bounded size and SHA-256 checksum', () => {
    const good = { version: 0, documentType: 'PASSPORT', originalFilename: 'synthetic.pdf', sizeBytes: 25, checksumSha256: 'A'.repeat(43) + '=' };
    for (const contentType of ['application/pdf', 'image/jpeg', 'image/png']) {
      expect(strict(IdDocumentUploadIntentDto, { ...good, contentType })).toHaveLength(0);
    }
    expect(strict(IdDocumentUploadIntentDto, { ...good, contentType: 'text/plain' }).length).toBeGreaterThan(0);
    expect(strict(IdDocumentUploadIntentDto, { ...good, contentType: 'application/pdf', sizeBytes: 10 * 1024 * 1024 + 1 }).length).toBeGreaterThan(0);
    expect(strict(IdDocumentUploadIntentDto, { ...good, contentType: 'application/pdf', checksumSha256: 'not-a-checksum' }).length).toBeGreaterThan(0);
  });

});
