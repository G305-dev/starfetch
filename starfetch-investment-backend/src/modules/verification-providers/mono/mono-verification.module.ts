import { Module } from '@nestjs/common';
import { ConfigVerificationOperationKeyring, VERIFICATION_OPERATION_KEYRING } from '../verification-operation-keyring';
import { VerificationConsentService } from '../verification-consent.service';
import { FetchMonoHttpTransport } from './mono-http-transport';
import { MonoProveAdapter } from './mono-prove.adapter';
import { MonoLookupAdapter } from './mono-lookup.adapter';
import { FetchMonoLookupHttpTransport } from './mono-lookup-http-transport';
import { MONO_LOOKUP_EVIDENCE_JOURNAL, MONO_LOOKUP_HTTP_TRANSPORT } from './mono-lookup-ports';
import { PrismaMonoLookupEvidenceJournal } from './prisma-mono-lookup-evidence-journal';
import { MonoProveWebhookProcessor } from './mono-prove-webhook.processor';
import { PrismaMonoEvidenceJournal } from './prisma-mono-evidence-journal';
import {
  MONO_EVIDENCE_JOURNAL,
  MONO_HTTP_TRANSPORT,
  MONO_PROVE_CONSENT_AUTHORIZER,
} from './mono-verification-ports';

/** Internal, default-disabled adapters. No public route is registered. */
@Module({
  providers: [
    MonoProveAdapter,
    MonoProveWebhookProcessor,
    MonoLookupAdapter,
    FetchMonoLookupHttpTransport,
    PrismaMonoLookupEvidenceJournal,
    { provide: MONO_LOOKUP_HTTP_TRANSPORT, useExisting: FetchMonoLookupHttpTransport },
    { provide: MONO_LOOKUP_EVIDENCE_JOURNAL, useExisting: PrismaMonoLookupEvidenceJournal },
    FetchMonoHttpTransport,
    VerificationConsentService,
    PrismaMonoEvidenceJournal,
    ConfigVerificationOperationKeyring,
    { provide: VERIFICATION_OPERATION_KEYRING, useExisting: ConfigVerificationOperationKeyring },
    { provide: MONO_HTTP_TRANSPORT, useExisting: FetchMonoHttpTransport },
    { provide: MONO_PROVE_CONSENT_AUTHORIZER, useExisting: VerificationConsentService },
    { provide: MONO_EVIDENCE_JOURNAL, useExisting: PrismaMonoEvidenceJournal },
  ],
  exports: [MonoProveAdapter, MonoProveWebhookProcessor, MonoLookupAdapter, VerificationConsentService],
})
export class MonoVerificationModule {}
