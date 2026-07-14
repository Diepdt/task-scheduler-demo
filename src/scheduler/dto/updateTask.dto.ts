import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class UpdateTaskDto {
    @IsNotEmpty()
    @IsString()
    title!: string;

    @IsNotEmpty()
    @IsString()
    expression!: string;
}