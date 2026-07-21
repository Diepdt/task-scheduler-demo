import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { TaskProcessor } from './task.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'task-scheduler',
    }),
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, TaskProcessor],
})
export class SchedulerModule {}

