import { Module } from '@nestjs/common';
import { CrmTasksService } from './crm-tasks.service';
import { CrmTasksController } from './crm-tasks.controller';

@Module({
  providers: [CrmTasksService],
  controllers: [CrmTasksController],
  exports: [CrmTasksService],
})
export class CrmTasksModule {}
