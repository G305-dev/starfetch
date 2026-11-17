import { IsDateString, IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class ClaimIndividualKycScanJobDto {}

export class IndividualKycScanResultDto {
  @IsEnum({ CLEAN: 'CLEAN', INFECTED: 'INFECTED', FAILED: 'FAILED' })
  outcome!: 'CLEAN' | 'INFECTED' | 'FAILED';

  @IsString()
  @Length(1, 256)
  objectVersionId!: string;

  @IsString()
  @Length(44, 44)
  @Matches(/^[A-Za-z0-9+/]{43}=$/)
  sha256Base64!: string;

  @IsEnum({ clamd: 'clamd' })
  scannerEngine!: 'clamd';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]{1,64}$/)
  scannerVersion!: string | null;

  @IsDateString()
  scannedAt!: string;

  @IsString()
  @Length(40, 128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  scanJobToken!: string;
}
