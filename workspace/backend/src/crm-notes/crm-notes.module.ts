import { Module } from '@nestjs/common';
import { CrmNotesService } from './crm-notes.service';
import { CrmNotesController } from './crm-notes.controller';

@Module({
  providers: [CrmNotesService],
  controllers: [CrmNotesController],
  exports: [CrmNotesService],
})
export class CrmNotesModule {}
