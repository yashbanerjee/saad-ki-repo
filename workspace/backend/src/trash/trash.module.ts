import { Global, Module } from '@nestjs/common';
import { TrashService } from './trash.service';
import { TrashController } from './trash.controller';

@Global()
@Module({
  providers: [TrashService],
  controllers: [TrashController],
  exports: [TrashService],
})
export class TrashModule {}
