import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MariaPrismaService } from '../prisma/maria-prisma.service';
import CronExpressionParser from 'cron-parser';

@Injectable()
export class SyncService {
  constructor(
    private readonly postgres: PrismaService,
    private readonly maria: MariaPrismaService,
  ) {}

  // 1. Thực thi tiến trình đồng bộ
  async runSync() {
    const startTime = new Date();
    
    // Tạo bản ghi log trạng thái RUNNING
    const log = await this.postgres.syncLog.create({
      data: {
        startedAt: startTime,
        status: 'RUNNING',
      },
    });

    try {
      // Tìm thời gian đồng bộ thành công gần nhất
      const lastSuccessLog = await this.postgres.syncLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { startedAt: 'desc' },
      });
      const lastSyncTime = lastSuccessLog ? lastSuccessLog.startedAt : new Date(0);

      // Lấy toàn bộ users đã cập nhật ở PostgreSQL kể từ thời điểm đồng bộ trước
      const updatedUsers = await this.postgres.user.findMany({
        where: {
          updatedAt: {
            gt: lastSyncTime,
          },
        },
      });

      let syncedCount = 0;
      if (updatedUsers.length > 0) {
        // Đồng bộ từng user sang MariaDB bằng Upsert
        for (const user of updatedUsers) {
          await this.maria.syncedUser.upsert({
            where: { id: user.id },
            update: {
              email: user.email,
              password: user.password,
              name: user.name,
              phone: user.phone,
              role: user.role,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              syncedAt: new Date(),
            },
            create: {
              id: user.id,
              email: user.email,
              password: user.password,
              name: user.name,
              phone: user.phone,
              role: user.role,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
          });
          syncedCount++;
        }
      }

      // Cập nhật log thành công
      await this.postgres.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          recordsCount: syncedCount,
        },
      });

      console.log(`[SyncService] Đồng bộ thành công: ${syncedCount} bản ghi.`);
      return { success: true, syncedCount };
    } catch (error: any) {
      console.error(`[SyncService] Lỗi đồng bộ: ${error.message}`);
      
      // Cập nhật log thất bại
      await this.postgres.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          message: error.message,
        },
      });

      return { success: false, error: error.message };
    }
  }

  // 2. Lấy thông tin trạng thái & lịch sử đồng bộ
  async getSyncStatus() {
    const lastSuccessLog = await this.postgres.syncLog.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
    });

    const history = await this.postgres.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    // Tìm lịch chạy của Cron Job đồng bộ trong Database
    const syncTask = await this.postgres.task.findFirst({
      where: {
        title: {
          contains: 'Đồng bộ',
        },
      },
    });

    let nextRun: Date | null = null;
    if (syncTask) {
      try {
        const interval = CronExpressionParser.parse(syncTask.expression);
        nextRun = interval.next().toDate();
      } catch (e) {}
    }

    return {
      lastSyncTime: lastSuccessLog ? lastSuccessLog.startedAt : null,
      nextRun,
      history,
    };
  }
}
