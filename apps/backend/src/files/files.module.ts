import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { UploadChunkConcurrencyGuard } from './upload-chunk-concurrency.guard';

@Module({
  controllers: [FilesController],
  providers: [FilesService, UploadChunkConcurrencyGuard],
})
export class FilesModule {}
