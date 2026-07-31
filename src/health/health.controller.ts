import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, HealthCheckResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { MariaPrismaService } from '../prisma/maria-prisma.service';
import { MinioService } from '../minio/minio.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PrismaService,
    private readonly maria: MariaPrismaService,
    private readonly minioService: MinioService,
    @InjectQueue('task-scheduler') private readonly taskQueue: Queue,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Kiểm tra trạng thái kết nối của hệ thống (Postgres, MariaDB, Redis, MinIO)' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      // 1. Kiểm tra PostgreSQL (Primary DB)
      async () => {
        try {
          await this.postgres.$queryRaw`SELECT 1`;
          return { postgres: { status: 'up' } };
        } catch (e: any) {
          throw new HealthCheckError('PostgreSQL check failed', { postgres: { status: 'down', message: e.message } });
        }
      },
      // 2. Kiểm tra MariaDB (Secondary DB)
      async () => {
        try {
          await this.maria.$queryRaw`SELECT 1`;
          return { mariadb: { status: 'up' } };
        } catch (e: any) {
          throw new HealthCheckError('MariaDB check failed', { mariadb: { status: 'down', message: e.message } });
        }
      },
      // 3. Kiểm tra Redis thông qua BullMQ client connection
      async () => {
        try {
          const client: any = await this.taskQueue.client;
          await client.ping();
          return { redis: { status: 'up' } };
        } catch (e: any) {
          throw new HealthCheckError('Redis check failed', { redis: { status: 'down', message: e.message } });
        }
      },
      // 4. Kiểm tra MinIO (Object Storage)
      async () => {
        const isUp = await this.minioService.ping();
        if (isUp) {
          return { minio: { status: 'up' } };
        } else {
          throw new HealthCheckError('MinIO check failed', { minio: { status: 'down', message: 'MinIO is unreachable' } });
        }
      },
    ]);
  }
}
