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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Scheduler')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post('/validate')
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Kiểm tra tính hợp lệ của biểu thức Cron' })
  validate(@Body() dto: ValidateCronDto) {
    return this.schedulerService.validate(dto);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Tạo mới một Cron Job động' })
  create(@Body() dto: CreateTaskDTO) {
    return this.schedulerService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Lấy danh sách các Cron Job đang được lập lịch' })
  get() {
    return this.schedulerService.get();
  }

  @Get(':id/logs')
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Lấy lịch sử logs chạy của một Job theo ID' })
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.getLogs(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Cập nhật chu kỳ/cấu hình của một Cron Job động' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.schedulerService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Xóa hoàn toàn một Cron Job' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.delete(id);
  }
}
