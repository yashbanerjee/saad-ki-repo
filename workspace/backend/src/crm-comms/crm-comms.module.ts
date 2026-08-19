import { Module } from '@nestjs/common';
import { CrmCommsService } from './crm-comms.service';
import { CrmCommsController } from './crm-comms.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [IntegrationsModule, StorageModule],
  providers: [CrmCommsService],
  controllers: [CrmCommsController],
  exports: [CrmCommsService],
})
export class CrmCommsModule {}
