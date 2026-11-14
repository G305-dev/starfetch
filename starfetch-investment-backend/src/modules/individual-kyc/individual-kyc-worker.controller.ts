import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedKycWorkerRequest, IndividualKycWorkerAuthGuard } from './individual-kyc-worker-auth';
import { IndividualKycScanResultDto } from './dto/individual-kyc-worker.dto';
import { IndividualKycWorkerService } from './individual-kyc-worker.service';

/** Internal service-to-service endpoints. They are not customer or staff review APIs. */
@Controller('internal/individual-kyc/scan-jobs')
@UseGuards(IndividualKycWorkerAuthGuard)
export class IndividualKycWorkerController {
  constructor(private readonly worker: IndividualKycWorkerService) {}

  @Post('claim')
  claim(@Req() request: AuthenticatedKycWorkerRequest) {
    return this.worker.claimNext(request.individualKycWorkerId!);
  }

  @Post(':documentId/result')
  recordResult(
    @Req() request: AuthenticatedKycWorkerRequest,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Body() result: IndividualKycScanResultDto,
  ) {
    return this.worker.recordResult(documentId, request.individualKycWorkerId!, result);
  }

  @Post('cleanup')
  cleanup(@Req() request: AuthenticatedKycWorkerRequest) {
    return this.worker.cleanupExpired(request.individualKycWorkerId!);
  }
}
