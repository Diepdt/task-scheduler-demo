import { Controller, Get, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Data Sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái và lịch sử đồng bộ giữa Postgres & MariaDB' })
  getStatus() {
    return this.syncService.getSyncStatus();
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Kích hoạt tiến trình đồng bộ thủ công ngay lập tức' })
  triggerSync() {
    return this.syncService.runSync();
  }
}
