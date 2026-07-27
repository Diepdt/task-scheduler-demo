import { Module } from '@nestjs/common';
import { PostgresPrismaService } from './postgres-prisma.service';

@Module({
  providers: [PostgresPrismaService],
  exports: [PostgresPrismaService],
})
export class PostgresPrismaModule {}
