import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ValidateCronDto } from './dto/validate-cron.dto';
import { CreateTaskDTO } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';
import { ParseIntPipe } from '@nestjs/common';

@Controller('scheduler')
export class SchedulerController {
    constructor (private schedulerService: SchedulerService) {}

    @Post('/validate')
    validate(@Body() dto: ValidateCronDto) {
        return this.schedulerService.validate(dto);
    }

    @Post()
    create(@Body() dto: CreateTaskDTO) {
        return this.schedulerService.crete(dto);
    }

    @Get()
    get() {
        return this.schedulerService.get();
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
