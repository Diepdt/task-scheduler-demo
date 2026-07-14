import { IsNotEmpty, IsString } from "class-validator";

export class ValidateCronDto {
    @IsNotEmpty()
    @IsString()
    expression!: string;
}