import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ValidateCronDto } from './dto/validate-cron.dto';
import { CreateTaskDTO } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';

@Controller('scheduler')
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post('/validate')
  validate(@Body() dto: ValidateCronDto) {
    return this.schedulerService.validate(dto);
  }

  @Post()
  create(@Body() dto: CreateTaskDTO) {
    return this.schedulerService.create(dto);
  }

  @Get()
  get() {
    return this.schedulerService.get();
  }

  @Get(':id/logs')
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.getLogs(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTaskDto) {
    return this.schedulerService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.delete(id);
  }
}
