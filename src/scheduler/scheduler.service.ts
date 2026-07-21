import { Body, Injectable, Post } from '@nestjs/common';
import { ValidateCronDto } from './dto/validate-cron.dto';
import CronExpressionParser from 'cron-parser';
import { CreateTaskDTO } from './dto/createTask.dto';
import { UpdateTaskDto } from './dto/updateTask.dto';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Task } from './interfaces/task.interface';

@Injectable()
export class SchedulerService {
    constructor(
        private readonly schedulerRegistry: SchedulerRegistry,
    ) {}

    private tasks: Task[] = [];
    private nextId = 1;

    validate(dto: ValidateCronDto) {
        try {
            const interval = CronExpressionParser.parse(dto.expression);
            return {nextRun: interval.next().toDate()};
        } catch(error: any) {
            return {message: error.message};
        }
    }

    private getNextRun(expression: string): Date {
        const interval = CronExpressionParser.parse(expression);
        return interval.next().toDate();
    }

    create(dto: CreateTaskDTO) {
        try {
            this.getNextRun(dto.expression);
            const task  : Task = {
                id: this.nextId++,
                title: dto.title,
                expression: dto.expression
            }
            this.tasks.push(task);
            this.registerTask(task);
            return {
                message: 'Create successfully!',
                data: task
            }
        } catch (error: any) {
            return {message: error.message}
        }
    }

    get() {
        return this.tasks;
    }

    update(id: number, dto: UpdateTaskDto) {
        try {
            const foundTask = this.tasks.find(t => t.id === id);
            if (foundTask) {
                this.getNextRun(dto.expression);
                const oldJob = this.schedulerRegistry.getCronJob(id.toString());
                oldJob.stop();
                this.schedulerRegistry.deleteCronJob(id.toString());
                foundTask.title = dto.title;
                foundTask.expression = dto.expression;
                this.registerTask(foundTask);
                return {
                    message: 'Update successfully!',
                    data: foundTask,
                };
            } else {
                return {message: 'Not found Task!'};
            }
        } catch(error: any) {
            return {message: error.message};
        }
    }

    delete(id: number) {
        try {
            this.tasks = this.tasks.filter(i => i.id !== id);
            const job = this.schedulerRegistry.getCronJob(id.toString());
            job.stop();
            this.schedulerRegistry.deleteCronJob(id.toString());
            return {message: "Delete successfully!"};
        } catch(error: any) {
            return {message: error.message};
        }
    }

    private registerTask(task: Task) {
        const job = new CronJob(task.expression, () => {
            console.log(`Execute Task: ${task.title}`);
        });
        this.schedulerRegistry.addCronJob(task.id.toString(), job);
        job.start();
    }
}
