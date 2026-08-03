import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as crypto from 'crypto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { MinioService } from '../minio/minio.service';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Role } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    @InjectQueue('import-users') private readonly importQueue: Queue,
  ) { }

  async create(dto: CreateUserDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email này đã được đăng ký sử dụng!');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Số điện thoại này đã được đăng ký sử dụng!');
    }

    const hashedPassword = crypto.createHash('sha256').update(dto.password).digest('hex');

    return this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });
  }

  async findAll(query: GetUsersQueryDto) {
    const { page = 1, limit = 10, search, role, sortBy = 'id', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const total = await this.prisma.user.count({ where });
    const data = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID ${id}`);
    }
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          NOT: { id },
        },
      });
      if (existingUser) {
        throw new ConflictException('Email này đã được sử dụng bởi người dùng khác!');
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: {
          phone: dto.phone,
          NOT: { id },
        },
      });
      if (existingPhone) {
        throw new ConflictException('Số điện thoại này đã được sử dụng bởi người dùng khác!');
      }
    }

    const updateData = { ...dto };
    if (dto.password) {
      updateData.password = crypto.createHash('sha256').update(dto.password).digest('hex');
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({
      where: { id },
    });
    return { message: `Xóa thành công người dùng với ID ${id}` };
  }

  // 1. Tải file excel template mẫu
  async getImportTemplate(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    worksheet.addRow(['Email', 'Mật khẩu', 'Tên', 'Số điện thoại', 'Quyền (Role)']);
    worksheet.addRow(['nguyenvana@example.com', 'password123', 'Nguyễn Văn A', '0987654321', 'USER']);
    worksheet.addRow(['tranthib@example.com', 'password456', 'Trần Thị B', '0912345678', 'STAFF']);
    worksheet.addRow(['admin@example.com', 'adminpass', 'Quản Trị Viên', '0901234567', 'ADMIN']);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=user-import-template.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  }

  // 2. Preview kiểm tra trước khi import (chưa ghi DB)
  async previewImport(fileBuffer: Buffer, originalName: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('File Excel trống hoặc không đúng định dạng!');
    }

    const validRows: any[] = [];
    const invalidRows: any[] = [];
    const promises: Promise<void>[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const cleanCellText = (cell: any): string => {
        if (!cell) return '';
        const val = cell.value;
        if (val && typeof val === 'object') {
          if ('text' in val) return String(val.text || '').trim();
          if ('result' in val) return String(val.result || '').trim();
        }
        return String(val !== undefined && val !== null ? val : (cell.text || '')).trim();
      };

      let email = cleanCellText(row.getCell(1));
      if (email.toLowerCase().startsWith('mailto:')) {
        email = email.substring(7).trim();
      }
      const password = cleanCellText(row.getCell(2));
      const name = cleanCellText(row.getCell(3));
      const phone = cleanCellText(row.getCell(4));
      const role = cleanCellText(row.getCell(5)) as Role;

      const p = (async () => {
        const userDto = plainToInstance(CreateUserDto, { email, password, name, phone, role });
        const errors = await validate(userDto);

        if (errors.length > 0) {
          const errorMsg = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
          invalidRows.push({ row: rowNumber, email, name, phone, role, reason: errorMsg });
        } else {
          const existingEmail = await this.prisma.user.findUnique({ where: { email } });
          const existingPhone = await this.prisma.user.findUnique({ where: { phone } });

          if (existingEmail) {
            invalidRows.push({ row: rowNumber, email, name, phone, role, reason: 'Email đã tồn tại' });
          } else if (existingPhone) {
            invalidRows.push({ row: rowNumber, email, name, phone, role, reason: 'Số điện thoại đã tồn tại' });
          } else {
            validRows.push({ row: rowNumber, email, name, phone, role });
          }
        }
      })();
      promises.push(p);
    });

    await Promise.all(promises);

    // Lưu file tạm lên MinIO để bước Confirm có thể tải và xử lý
    const previewKey = `temp-imports/import-${Date.now()}-${originalName}`;
    await this.minioService.uploadFile(
      'excel-logs',
      previewKey,
      fileBuffer,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return {
      previewKey,
      totalRows: validRows.length + invalidRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      errors: invalidRows.sort((a, b) => a.row - b.row),
    };
  }

  // 3. Confirm thực hiện import thật thông qua BullMQ
  async confirmImport(previewKey: string) {
    const job = await this.importQueue.add('process-import', { previewKey });
    return {
      message: 'Xác nhận import thành công! Tiến trình đã được đưa vào hàng đợi xử lý ngầm (BullMQ).',
      jobId: job.id,
    };
  }

  // Lấy trạng thái của Job trong hàng đợi BullMQ
  async getImportStatus(jobId: string) {
    const job = await this.importQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Không tìm thấy Job với ID ${jobId}`);
    }
    const state = await job.getState();
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return {
      id: job.id,
      state,
      progress: job.progress,
      result,
      failedReason,
    };
  }


  // 2. Xuất dữ liệu ra Excel (Export)
  async exportExcel(query: GetUsersQueryDto, res: Response) {
    const { search, role, sortBy = 'id', sortOrder = 'desc' } = query;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách Người dùng');

    worksheet.addRow(['ID', 'Email', 'Tên', 'Số điện thoại', 'Quyền (Role)', 'Ngày tạo']);

    users.forEach(u => {
      worksheet.addRow([
        u.id,
        u.email,
        u.name,
        u.phone,
        u.role,
        u.createdAt.toISOString(),
      ]);
    });

    // Cấu hình Header báo hiệu cho trình duyệt đây là file Excel tải xuống
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  }

  // 3. Seed nhanh 100.000 bản ghi mẫu
  async seedDemoUsers() {
    const count = 100000;
    const batchSize = 10000;
    const roles = [Role.USER, Role.STAFF, Role.ADMIN];
    let seededCount = 0;

    for (let batchStart = 1; batchStart <= count; batchStart += batchSize) {
      const usersData: any[] = [];
      const batchEnd = Math.min(batchStart + batchSize - 1, count);
      
      for (let i = batchStart; i <= batchEnd; i++) {
        const timestamp = Date.now();
        const randomStr = crypto.randomBytes(4).toString('hex');
        const email = `demo.user${i}.${timestamp}.${randomStr}@example.com`;
        
        // Random 10-digit Vietnamese phone number
        const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
        
        usersData.push({
          email,
          password: `password_demo_${i}`,
          name: `Demo User ${i}`,
          phone: randomPhone,
          role: roles[i % 3],
        });
      }

      await this.prisma.user.createMany({
        data: usersData,
        skipDuplicates: true,
      });

      seededCount += usersData.length;
      console.log(`[UserService] Đã seed ${seededCount}/${count} users...`);
    }

    return { message: `Đã seed thành công ${seededCount} người dùng mẫu vào PostgreSQL.` };
  }
}
