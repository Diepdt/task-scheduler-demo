import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { ImportProcessor } from './import.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'import-users',
    }),
  ],
  controllers: [UserController],
  providers: [UserService, ImportProcessor],
  exports: [UserService],
})
export class UserModule {}
