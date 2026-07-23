import { Module } from '@nestjs/common';
import { NdaService } from './nda.service';
import { NdaController } from './nda.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [NdaService],
  controllers: [NdaController],
  exports: [NdaService],
})
export class NdaModule {}
