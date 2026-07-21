import { Injectable, OnModuleInit } from '@nestjs/common';
import { ValidateCronDto } from './dto/validate-cron.dto';
import CronExpressionParser from 'cron-parser';
import { CreateTaskDTO } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

type TaskRecord = {
  id: number;
  title: string;
  expression: string;
};

@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectQueue('task-scheduler') private readonly taskQueue: Queue,
  ) {}

  async onModuleInit() {
    const tasks = await this.prisma.task.findMany();
    for (const task of tasks) {
      this.registerTask(task);
    }
  }

  validate(dto: ValidateCronDto) {
    try {
      const interval = CronExpressionParser.parse(dto.expression);
      return { nextRun: interval.next().toDate() };
    } catch (error: unknown) {
      return { message: this.getErrorMessage(error) };
    }
  }

  private getNextRun(expression: string): Date {
    const interval = CronExpressionParser.parse(expression);
    return interval.next().toDate();
  }

  async create(dto: CreateTaskDTO) {
    try {
      this.getNextRun(dto.expression);
      const createdTask = await this.prisma.task.create({
        data: {
          title: dto.title,
          expression: dto.expression,
        },
      });

      this.registerTask(createdTask);

      return {
        message: 'Create successfully!',
        data: createdTask,
      };
    } catch (error: unknown) {
      return { message: this.getErrorMessage(error) };
    }
  }

  get() {
    return this.prisma.task.findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async update(id: number, dto: UpdateTaskDto) {
    try {
      this.getNextRun(dto.expression);

      const foundTask = await this.prisma.task.findUnique({
        where: { id },
      });

      if (!foundTask) {
        return { message: 'Not found Task!' };
      }

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: {
          title: dto.title,
          expression: dto.expression,
        },
      });

      this.stopTaskJob(id);
      this.registerTask(updatedTask);

      return {
        message: 'Update successfully!',
        data: updatedTask,
      };
    } catch (error: unknown) {
      return { message: this.getErrorMessage(error) };
    }
  }

  async delete(id: number) {
    try {
      this.stopTaskJob(id);

      const foundTask = await this.prisma.task.findUnique({
        where: { id },
      });

      if (!foundTask) {
        return { message: 'Not found Task!' };
      }

      await this.prisma.task.delete({
        where: { id },
      });

      return { message: 'Delete successfully!' };
    } catch (error: unknown) {
      return { message: this.getErrorMessage(error) };
    }
  }

  async getLogs(taskId: number) {
    return this.prisma.taskLog.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private registerTask(task: TaskRecord) {
    const job = new CronJob(task.expression, async () => {
      console.log(`[Scheduler] Cron triggered for task "${task.title}" (ID: ${task.id}). Dispatching to BullMQ queue...`);
      await this.taskQueue.add(
        'execute-task',
        {
          taskId: task.id,
          title: task.title,
        },
        {
          attempts: 3,
          backoff: 5000,
        },
      );
    });

    void this.schedulerRegistry.addCronJob(task.id.toString(), job);
    void job.start();
  }

  private stopTaskJob(id: number) {
    if (!this.schedulerRegistry.doesExist('cron', id.toString())) {
      return;
    }

    const job = this.schedulerRegistry.getCronJob(id.toString());
    void job.stop();
    void this.schedulerRegistry.deleteCronJob(id.toString());
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}

