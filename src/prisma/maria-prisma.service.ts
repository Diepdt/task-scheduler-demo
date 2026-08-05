import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@internal/prisma/mariadb-client';

@Injectable()
export class MariaPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MariaPrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.MARIADB_URL,
        },
      },
    });
  }

  // retry lại kết nối database, thử lại tối đa 5 lần, mỗi lần cách nhau 5s
  async onModuleInit() {
    const MaxRetries = 5;
    const delayMs = 5000;

    for (let attempt = 1; attempt <= MaxRetries; attempt++) {
      try {
        this.logger.log(`Connecting to Maria database (Attempt ${attempt}/{maxRetries})...`);
        await this.$connect();
        this.logger.log(`Connecting Maria database successfully`);
        break;
      } catch (error) {
        this.logger.error(`Fail to connect to Maria database on attempt ${attempt}. Error: ${error.message}`);

        if (attempt === MaxRetries) {
          this.logger.error(`Max connection attempts reached. Application may not function correctly.`);
          throw error;
        }

        this.logger.log(`Waiting ${delayMs / 1000}s before retrying...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
