import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { SetupController } from './setup.controller';

@Module({
  providers: [ClientsService],
  controllers: [ClientsController, SetupController],
  exports: [ClientsService],
})
export class ClientsModule {}
