import { Module } from '@nestjs/common';
import { CrmCommsService } from './crm-comms.service';
import { CrmCommsController } from './crm-comms.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [IntegrationsModule],
  providers: [CrmCommsService],
  controllers: [CrmCommsController],
  exports: [CrmCommsService],
})
export class CrmCommsModule {}
