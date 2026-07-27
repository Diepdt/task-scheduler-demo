import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PostgresPrismaModule } from './postgres-prisma.module';

@Module({
  imports: [PostgresPrismaModule],
  providers: [PrismaService],
  exports: [PrismaService, PostgresPrismaModule],
})
export class PrismaModule {}
