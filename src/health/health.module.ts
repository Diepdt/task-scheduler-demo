import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MariaPrismaModule } from '../prisma/maria-prisma.module';
import { MinioModule } from '../minio/minio.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    TerminusModule,
    PrismaModule,
    MariaPrismaModule,
    MinioModule,
    BullModule.registerQueue({
      name: 'task-scheduler',
    }),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
