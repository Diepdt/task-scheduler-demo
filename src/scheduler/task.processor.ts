import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../sync/sync.service';
import { EmailService } from 'src/common/services/email.service';

export type TaskJobData = {
  taskId: number;
  title: string;
};

@Processor('task-scheduler')
export class TaskProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
    private readonly emailService: EmailService
  ) {
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

      // Logic xử lý đồng bộ dữ liệu cũ
      if (title.includes('Đồng bộ dữ liệu')) {
        console.log(`[BullMQ Worker] Kích hoạt tiến trình đồng bộ tự động từ Task Scheduler...`);
        const syncResult = await this.syncService.runSync();
        if (!syncResult.success) {
          throw new Error(syncResult.error || 'Lỗi đồng bộ dữ liệu');
        }
      }

      // Logic xử lý gửi Email chúc mừng sinh nhật
      if (title.includes('Chúc mừng sinh nhật')) {
        console.log(`[BullMQ Worker] Kích hoạt tiến trình gửi email chúc mừng sinh nhật...`);

        const today = new Date();
        const currentMonth = today.getMonth() + 1;
        const currnentDate = today.getDate();

        const userWithBirthday = await this.prisma.user.findMany({
          where: {
            birthday: { not: null }
          },
          select: { email: true, name: true, birthday: true }
        })

        const birthdayUsers = userWithBirthday.filter((user) => {
          if (!user.birthday) return false;
          const userDob = new Date(user.birthday);
          return userDob.getMonth() + 1 === currentMonth && userDob.getDate() === currnentDate
        });

        for (const user of birthdayUsers) {
          await this.emailService.sendBirthdayWish(user.email, user.name);
        }
      }

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
