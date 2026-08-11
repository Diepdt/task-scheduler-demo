import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ValidateCronDto } from './dto/validate-cron.dto';
import { CreateTaskDTO } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Scheduler')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post('/validate')
  @RequirePermissions('TASK_READ')
  @ApiOperation({ summary: 'Kiểm tra tính hợp lệ của biểu thức Cron' })
  validate(@Body() dto: ValidateCronDto) {
    return this.schedulerService.validate(dto);
  }

  @Post()
  @RequirePermissions('TASK_RUN')
  @ApiOperation({ summary: 'Tạo mới một Cron Job động' })
  create(@Body() dto: CreateTaskDTO) {
    return this.schedulerService.create(dto);
  }

  @Get()
  @RequirePermissions('TASK_READ')
  @ApiOperation({ summary: 'Lấy danh sách các Cron Job đang được lập lịch' })
  get() {
    return this.schedulerService.get();
  }

  @Get(':id/logs')
  @RequirePermissions('TASK_READ')
  @ApiOperation({ summary: 'Lấy lịch sử logs chạy của một Job theo ID' })
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.getLogs(id);
  }

  @Put(':id')
  @RequirePermissions('TASK_RUN')
  @ApiOperation({ summary: 'Cập nhật chu kỳ/cấu hình của một Cron Job động' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.schedulerService.update(id, body);
  }

  @Delete(':id')
  @RequirePermissions('TASK_RUN')
  @ApiOperation({ summary: 'Xóa hoàn toàn một Cron Job' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.delete(id);
  }
}
