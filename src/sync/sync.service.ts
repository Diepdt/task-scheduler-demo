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

  // 1. Thực thi tiến trình đồng bộ (Tối ưu hóa: Batching, Keyset Pagination, Bulk Upsert, Checkpoint)
  async runSync() {
    const startTime = new Date();
    
    // Tạo bản ghi log trạng thái RUNNING
    const log = await this.postgres.syncLog.create({
      data: {
        startedAt: startTime,
        status: 'RUNNING',
        recordsCount: 0,
        lastProcessedId: 0,
      },
    });

    try {
      // Tìm thời gian đồng bộ thành công gần nhất
      const lastSuccessLog = await this.postgres.syncLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { startedAt: 'desc' },
      });
      const lastSyncTime = lastSuccessLog ? lastSuccessLog.startedAt : new Date(0);

      // Kiểm tra xem có phiên đồng bộ bị sập/lỗi trước đó (chạy sau lastSyncTime) để khôi phục checkpoint
      const lastCrashedLog = await this.postgres.syncLog.findFirst({
        where: {
          startedAt: {
            gt: lastSyncTime,
          },
          id: {
            not: log.id,
          },
          lastProcessedId: {
            gt: 0,
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      let lastId = 0;
      if (lastCrashedLog) {
        lastId = lastCrashedLog.lastProcessedId;
        console.log(`[SyncService] Phát hiện phiên lỗi #${lastCrashedLog.id}. Khôi phục checkpoint tại ID: ${lastId}`);
      }

      let totalSyncedCount = 0;
      const batchSize = 5000;

      while (true) {
        // Đọc dữ liệu phân trang Keyset: id > lastId
        const batchUsers = await this.postgres.user.findMany({
          where: {
            updatedAt: {
              gt: lastSyncTime,
            },
            id: {
              gt: lastId,
            },
          },
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
          take: batchSize,
        });

        if (batchUsers.length === 0) {
          break; // Đã xử lý hết dữ liệu
        }

        // Tạo câu lệnh Bulk Upsert Raw SQL
        const valuesSql: string[] = [];
        const queryParams: any[] = [];

        for (const user of batchUsers) {
          const roleStr = user.userRoles.map((ur) => ur.role.name).join(',');
          valuesSql.push('(?, ?, ?, ?, ?, ?, ?, ?, NOW())');
          queryParams.push(
            user.id,
            user.email,
            user.password,
            user.name,
            user.phone,
            roleStr,
            user.createdAt,
            user.updatedAt
          );
        }

        const sql = `
          INSERT INTO SyncedUser (id, email, password, name, phone, role, createdAt, updatedAt, syncedAt)
          VALUES ${valuesSql.join(', ')}
          ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            password = VALUES(password),
            name = VALUES(name),
            phone = VALUES(phone),
            role = VALUES(role),
            createdAt = VALUES(createdAt),
            updatedAt = VALUES(updatedAt),
            syncedAt = NOW()
        `;

        // Thực thi Bulk Upsert sang MariaDB
        await this.maria.$executeRawUnsafe(sql, ...queryParams);

        // Cập nhật checkpoint sau mỗi Batch thành công
        lastId = batchUsers[batchUsers.length - 1].id;
        totalSyncedCount += batchUsers.length;

        await this.postgres.syncLog.update({
          where: { id: log.id },
          data: {
            recordsCount: totalSyncedCount,
            lastProcessedId: lastId,
          },
        });

        console.log(`[SyncService] Đồng bộ thành công Batch ${batchUsers.length} users. ID cuối: ${lastId}. Tổng đã đồng bộ: ${totalSyncedCount}`);
      }

      // Cập nhật log trạng thái thành công
      await this.postgres.syncLog.update({
        where: { id: log.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
        },
      });

      console.log(`[SyncService] Tiến trình hoàn tất thành công. Tổng: ${totalSyncedCount} bản ghi.`);
      return { success: true, syncedCount: totalSyncedCount };
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
