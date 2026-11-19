import { BadRequestException } from '@nestjs/common';
import {
  CORPORATE_HORIZONS, CORPORATE_OBJECTIVES, CORPORATE_RISK_CHOICES,
  CORPORATE_SOURCE_CHOICES, koboToNaira, ngnToKobo, parseCorporateProfileIfMatch, withdrawalsToKobo,
} from './corporate-profile.dto';

describe('Corporate Profile contract adapters', () => {
  it('pins the checked-in frontend labels and choices exactly', () => {
    expect(CORPORATE_OBJECTIVES).toEqual(['Capital preservation', 'Income', 'Balanced', 'Growth']);
    expect(CORPORATE_RISK_CHOICES).toEqual(['Conservative', 'Moderate', 'Balanced', 'Aggressive']);
    expect(CORPORATE_HORIZONS).toEqual(['< 1 year', '1–3 years', '3–5 years', '5 years +']);
    expect(CORPORATE_SOURCE_CHOICES).toEqual(['Business income / operating cash', 'Sale of assets', 'Loan / financing', 'Other (specify)']);
  });

  it('converts NGN to integer minor units without floating point', () => {
    expect(ngnToKobo('1000000')).toBe(100000000n);
    expect(ngnToKobo('1000000.25')).toBe(100000025n);
    expect(koboToNaira(100000025n)).toBe('1000000.25');
    expect(() => ngnToKobo('1.234')).toThrow();
  });

  it('supports the frontend withdrawal declaration and parses only unambiguous amounts', () => {
    expect(withdrawalsToKobo('₦500,000')).toBe(50000000n);
    expect(withdrawalsToKobo('No withdrawals planned')).toBeNull();
    expect(withdrawalsToKobo('As needed')).toBeNull();
    expect(() => withdrawalsToKobo('₦50,00')).toThrow();
  });

  it('requires quoted optimistic versions, including both company versions', () => {
    expect(parseCorporateProfileIfMatch('"profile-0;details-3"')).toEqual({ profileVersion: 0, detailsVersion: 3 });
    expect(parseCorporateProfileIfMatch('"profile-9"')).toEqual({ profileVersion: 9 });
    expect(() => parseCorporateProfileIfMatch('profile-1')).toThrow(BadRequestException);
    expect(() => parseCorporateProfileIfMatch('"profile-1;details-0"')).toThrow(BadRequestException);
  });
});
