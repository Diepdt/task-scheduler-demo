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
  Request,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { PermissionGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  @RequirePermissions('USER_CREATE')
  @ApiOperation({ summary: 'Tạo người dùng mới' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Lấy danh sách người dùng có phân trang, tìm kiếm, lọc và sắp xếp' })
  findAll(@Query() query: GetUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @Post('seed-demo')
  @RequirePermissions('USER_CREATE')
  @ApiOperation({ summary: 'Tạo nhanh 1000 tài khoản mẫu vào PostgreSQL để test' })
  seedDemo() {
    return this.userService.seedDemoUsers();
  }

  @Get('export')
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Xuất danh sách tất cả tài khoản ra file Excel theo bộ lọc' })
  export(
    @Res() res: any,
    @Query() query: GetUsersQueryDto,
  ) {
    return this.userService.exportExcel(query, res);
  }

  @Get('import/template')
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Tải file Excel mẫu để nhập liệu' })
  getTemplate(@Res() res: any) {
    return this.userService.getImportTemplate(res);
  }

  @Post('import/preview')
  @RequirePermissions('USER_CREATE')
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
  @RequirePermissions('USER_CREATE')
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

  @Get('import/status/:jobId')
  @RequirePermissions('USER_CREATE')
  @ApiOperation({ summary: 'Lấy trạng thái và kết quả của Job import từ BullMQ' })
  getImportStatus(@Param('jobId') jobId: string) {
    return this.userService.getImportStatus(jobId);
  }


  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Lấy thông tin profile cá nhân!' })
  getProfile(@Request() req) {
    return this.userService.findOne(req.user.id);
  }

  @Get(':id')
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Lấy chi tiết một người dùng theo ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findOne(id);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Người dùng cập nhật profile cá nhân!' })
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    const userId = req.user.id;
    // Bỏ roles để tránh việc user tự thay đổi quyền hạn của mình
    const { roles, ...profileData } = updateUserDto;
    return this.userService.update(userId, profileData);
  }

  @Patch(':id')
  @RequirePermissions('USER_CREATE')
  @ApiOperation({ summary: 'Cập nhật thông tin người dùng' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions('USER_DELETE')
  @ApiOperation({ summary: 'Xóa người dùng' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.remove(id);
  }

  @Get('rbac/roles')
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Lấy danh sách các vai trò' })
  getRoles() {
    return this.userService.getRoles();
  }

  @Get('rbac/permissions')
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Lấy danh sách các quyền hạn' })
  getPermissions() {
    return this.userService.getPermissions();
  }

  @Post('rbac/roles')
  @RequirePermissions('USER_CREATE')
  @ApiOperation({ summary: 'Tạo vai trò mới' })
  createRole(@Body() body: { name: string; description?: string; parentId?: number }) {
    return this.userService.createRole(body);
  }

  @Delete('rbac/roles/:id')
  @RequirePermissions('USER_DELETE')
  @ApiOperation({ summary: 'Xóa vai trò' })
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteRole(id);
  }

  @Get('rbac/roles/:id/permissions')
  @RequirePermissions('USER_READ')
  @ApiOperation({ summary: 'Lấy danh sách ID các quyền hạn đang được gán cho vai trò' })
  getRolePermissions(@Param('id', ParseIntPipe) id: number) {
    return this.userService.getRolePermissions(id);
  }

  @Post('rbac/roles/:id/permissions')
  @RequirePermissions('USER_CREATE')
  @ApiOperation({ summary: 'Cập nhật cấu hình gán danh sách quyền hạn cho vai trò' })
  updateRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body('permissionIds') permissionIds: number[],
  ) {
    return this.userService.updateRolePermissions(id, permissionIds);
  }
}
