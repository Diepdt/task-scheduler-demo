import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PostgresPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresPrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.POSTGRES_URL,
        },
      },
    });
  }

  // Retry kết nối lại database: tối đa 5 lần, mỗi lần cách nhau 5s
  async onModuleInit() {
    const maxRetries = 5;
    const delayMs = 5000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Trying to connect to database (attempt ${attempt}/${maxRetries})`);
        await this.$connect();
        this.logger.log(`Connecting database successfully!`);
        break;
      } catch (error) {
        this.logger.log(`Failed to connect to database: ${error}`);
        if (attempt === maxRetries) {
          this.logger.error(`Max connection attempts reached. Failing the application.`)
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
