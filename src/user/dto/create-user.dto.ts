import { IsEmail, IsNotEmpty, IsString, MinLength, IsArray, IsOptional, IsDateString } from 'class-validator';
import { IsVietnamesePhone } from '../../common/decorators/is-vietnamese-phone.decorator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải chứa ít nhất 6 ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name: string;

  @IsVietnamesePhone({ message: 'Số điện thoại không hợp lệ' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phone: string;

  @IsDateString({}, { message: 'Ngày sinh không đúng định dạng ISO' })
  @IsOptional()
  birthday?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roles?: string[];
}
