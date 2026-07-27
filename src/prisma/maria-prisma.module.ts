import { Module } from '@nestjs/common';
import { MariaPrismaService } from './maria-prisma.service';

@Module({
  providers: [MariaPrismaService],
  exports: [MariaPrismaService],
})
export class MariaPrismaModule {}
