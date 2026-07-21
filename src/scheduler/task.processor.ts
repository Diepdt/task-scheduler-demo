import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export type TaskJobData = {
  taskId: number;
  title: string;
};

@Processor('task-scheduler')
export class TaskProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TaskJobData>): Promise<void> {
    const { taskId, title } = job.data;
    const start = new Date();

    console.log(`[BullMQ Worker] Processing Job #${job.id} - Task ID: ${taskId}, Title: "${title}"`);

    const log = await this.prisma.taskLog.create({
      data: {
        taskId,
        status: 'RUNNING',
        startedAt: start,
      },
    });

    try {
      console.log(`[BullMQ Worker] Executing task: "${title}"`);

      await this.prisma.taskLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          durationMs: Date.now() - start.getTime(),
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.prisma.taskLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          message: errorMessage,
          finishedAt: new Date(),
          durationMs: Date.now() - start.getTime(),
        },
      });
      throw error;
    }
  }
}
