import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách người dùng có phân trang, tìm kiếm, lọc và sắp xếp' })
  findAll(@Query() query: GetUsersQueryDto) {
    return this.userService.findAll(query);
  }

  // API Seed nhanh 1000 users mẫu
  @Post('seed-demo')
  @ApiOperation({ summary: 'Tạo nhanh 1000 tài khoản mẫu vào PostgreSQL để test' })
  seedDemo() {
    return this.userService.seedDemoUsers();
  }

  // API Export danh sách ra file Excel trực tiếp
  @Get('export')
  @ApiOperation({ summary: 'Xuất danh sách tất cả tài khoản ra file Excel theo bộ lọc' })
  export(
    @Res() res: any,
    @Query() query: GetUsersQueryDto,
  ) {
    return this.userService.exportExcel(query, res);
  }

  // API lấy file template
  @Get('import/template')
  @ApiOperation({ summary: 'Tải file Excel mẫu để nhập liệu' })
  getTemplate(@Res() res: any) {
    return this.userService.getImportTemplate(res);
  }

  // API Preview Import Excel
  @Post('import/preview')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Xem trước (preview) kết quả và validate file Excel' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng tải lên file Excel (tham số "file")');
    }
    return this.userService.previewImport(file.buffer, file.originalname);
  }

  // API Confirm Import Excel
  @Post('import/confirm')
  @ApiOperation({ summary: 'Xác nhận import dữ liệu thật vào database (chạy qua BullMQ)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        previewKey: {
          type: 'string',
          description: 'Key của file Excel tạm đã preview thành công',
        },
      },
      required: ['previewKey'],
    },
  })
  confirm(@Body('previewKey') previewKey: string) {
    if (!previewKey) {
      throw new BadRequestException('Thiếu tham số previewKey!');
    }
    return this.userService.confirmImport(previewKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một người dùng theo ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa người dùng' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
