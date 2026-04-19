import { Module } from '@nestjs/common';
import { AdminRoutesController } from './admin-routes.controller';
import { AdminRoutesService } from './admin-routes.service';

@Module({
  controllers: [AdminRoutesController],
  providers: [AdminRoutesService],
})
export class AdminRoutesModule {}
