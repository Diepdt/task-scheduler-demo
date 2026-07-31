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
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Lấy danh sách người dùng có phân trang, tìm kiếm, lọc và sắp xếp' })
  findAll(@Query() query: GetUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @Post('seed-demo')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Tạo nhanh 1000 tài khoản mẫu vào PostgreSQL để test' })
  seedDemo() {
    return this.userService.seedDemoUsers();
  }

  @Get('export')
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Xuất danh sách tất cả tài khoản ra file Excel theo bộ lọc' })
  export(
    @Res() res: any,
    @Query() query: GetUsersQueryDto,
  ) {
    return this.userService.exportExcel(query, res);
  }

  @Get('import/template')
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Tải file Excel mẫu để nhập liệu' })
  getTemplate(@Res() res: any) {
    return this.userService.getImportTemplate(res);
  }

  @Post('import/preview')
  @Roles(Role.ADMIN, Role.STAFF)
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

  @Post('import/confirm')
  @Roles(Role.ADMIN, Role.STAFF)
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
  @Roles(Role.ADMIN, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Lấy chi tiết một người dùng theo ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Xóa người dùng' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }
}
