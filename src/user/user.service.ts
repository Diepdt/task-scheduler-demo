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
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    @InjectQueue('import-users') private readonly importQueue: Queue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async create(dto: CreateUserDto) {
    const { roles, ...userDto } = dto;
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: userDto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email này đã được đăng ký sử dụng!');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: userDto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Số điện thoại này đã được đăng ký sử dụng!');
    }

    const hashedPassword = crypto.createHash('sha256').update(userDto.password).digest('hex');

    const roleNames = roles && roles.length > 0 ? roles : ['USER'];
    const dbRoles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    return this.prisma.user.create({
      data: {
        ...userDto,
        birthday: userDto.birthday ? new Date(userDto.birthday) : null,
        password: hashedPassword,
        userRoles: {
          create: dbRoles.map((r) => ({
            roleId: r.id,
          })),
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
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
      where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    const total = await this.prisma.user.count({ where });
    const data = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
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
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với ID ${id}`);
    }
    const permissions = await this.getUserPermissions(id);
    return {
      ...user,
      permissions,
    };
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

    const { roles, ...updateDto } = dto;
    const updateData: any = { ...updateDto };
    if (updateDto.birthday !== undefined) {
      updateData.birthday = updateDto.birthday ? new Date(updateDto.birthday) : null;
    }
    if (dto.password) {
      updateData.password = crypto.createHash('sha256').update(dto.password).digest('hex');
    }

    if (roles) {
      const dbRoles = await this.prisma.role.findMany({
        where: { name: { in: roles } },
      });
      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });
      updateData.userRoles = {
        create: dbRoles.map((r) => ({
          roleId: r.id,
        })),
      };
    }

    const cacheKey = `user:permissions:${id}`;
    await this.cacheManager.del(cacheKey);

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({
      where: { id },
    });

    const cacheKey = `user:permissions:${id}`;
    await this.cacheManager.del(cacheKey);

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
    const rowsData: any[] = [];

    // 1. Đọc và làm sạch dữ liệu của từng dòng trước
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
      const role = cleanCellText(row.getCell(5));

      rowsData.push({ rowNumber, email, password, name, phone, role });
    });

    // 2. Gom tất cả email và số điện thoại để thực hiện truy vấn hàng loạt theo từng lô (Batch size 5000)
    const existingEmailsSet = new Set<string>();
    const existingPhonesSet = new Set<string>();
    const batchSize = 5000;

    for (let i = 0; i < rowsData.length; i += batchSize) {
      const chunk = rowsData.slice(i, i + batchSize);
      const chunkEmails = chunk.map(r => r.email).filter(Boolean);
      const chunkPhones = chunk.map(r => r.phone).filter(Boolean);

      if (chunkEmails.length > 0 || chunkPhones.length > 0) {
        const existingUsers = await this.prisma.user.findMany({
          where: {
            OR: [
              { email: { in: chunkEmails } },
              { phone: { in: chunkPhones } }
            ]
          },
          select: {
            email: true,
            phone: true
          }
        });

        for (const u of existingUsers) {
          existingEmailsSet.add(u.email);
          existingPhonesSet.add(u.phone);
        }
      }
    }

    // 3. Thực hiện validate và check trùng trên RAM
    for (const r of rowsData) {
      const userDto = plainToInstance(CreateUserDto, {
        email: r.email,
        password: r.password,
        name: r.name,
        phone: r.phone,
        roles: r.role ? [r.role] : [],
      });
      const errors = await validate(userDto);

      if (errors.length > 0) {
        const errorMsg = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
        invalidRows.push({ row: r.rowNumber, email: r.email, name: r.name, phone: r.phone, role: r.role, reason: errorMsg });
      } else {
        const hasDupEmail = existingEmailsSet.has(r.email);
        const hasDupPhone = existingPhonesSet.has(r.phone);

        if (hasDupEmail) {
          invalidRows.push({ row: r.rowNumber, email: r.email, name: r.name, phone: r.phone, role: r.role, reason: 'Email đã tồn tại' });
        } else if (hasDupPhone) {
          invalidRows.push({ row: r.rowNumber, email: r.email, name: r.name, phone: r.phone, role: r.role, reason: 'Số điện thoại đã tồn tại' });
        } else {
          validRows.push({ row: r.rowNumber, email: r.email, name: r.name, phone: r.phone, role: r.role });
        }
      }
    }

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
      where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh sách Người dùng');

    worksheet.addRow(['ID', 'Email', 'Tên', 'Số điện thoại', 'Quyền (Role)', 'Ngày tạo']);

    users.forEach(u => {
      const roleStr = u.userRoles.map((ur) => ur.role.name).join(',');
      worksheet.addRow([
        u.id,
        u.email,
        u.name,
        u.phone,
        roleStr,
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
    const roles = ['USER', 'STAFF', 'ADMIN'];
    let seededCount = 0;

    const dbRoles = await this.prisma.role.findMany({
      where: { name: { in: roles } },
    });
    const roleMap = dbRoles.reduce((acc, r) => {
      acc[r.name] = r.id;
      return acc;
    }, {} as Record<string, number>);

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
        });
      }

      await this.prisma.user.createMany({
        data: usersData,
        skipDuplicates: true,
      });

      const insertedUsers = await this.prisma.user.findMany({
        where: { email: { in: usersData.map((u) => u.email) } },
        select: { id: true, email: true },
      });

      const userRolesData = insertedUsers.map((u) => {
        const originalIndex = usersData.findIndex((o) => o.email === u.email);
        const roleName = roles[originalIndex % 3];
        const roleId = roleMap[roleName] || dbRoles[0].id;
        return {
          userId: u.id,
          roleId: roleId,
        };
      });

      await this.prisma.userRole.createMany({
        data: userRolesData,
        skipDuplicates: true,
      });

      seededCount += usersData.length;
      console.log(`[UserService] Đã seed ${seededCount}/${count} users...`);
    }

    return { message: `Đã seed thành công ${seededCount} người dùng mẫu vào PostgreSQL.` };
  }

  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        parent: true,
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async createRole(data: { name: string; description?: string; parentId?: number }) {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId ? Number(data.parentId) : null,
      },
    });
  }

  async deleteRole(id: number) {
    return this.prisma.role.delete({
      where: { id },
    });
  }

  async getRolePermissions(roleId: number) {
    const rps = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });
    return rps.map((rp) => rp.permissionId);
  }

  async updateRolePermissions(roleId: number, permissionIds: number[]) {
    await this.prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    if (permissionIds && permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((pid) => ({
          roleId,
          permissionId: Number(pid),
        })),
      });
    }

    return { message: 'Cấu hình quyền cho vai trò thành công!' };
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    const cacheKey = `user:permissions:${userId}`;
    let userPermissions = await this.cacheManager.get<string[]>(cacheKey);

    if (!userPermissions) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: true },
      });

      if (!user) return [];

      const directRoleIds = user.userRoles?.map((ur) => ur.roleId) || [];
      if (directRoleIds.length === 0) {
        return [];
      }

      const allRoleIds = await this.resolveInheritedRoles(directRoleIds);
      userPermissions = await this.getPermissionsForRoles(allRoleIds);

      await this.cacheManager.set(cacheKey, userPermissions, 3600000);
    }

    return userPermissions;
  }

  private async resolveInheritedRoles(roleIds: number[]): Promise<number[]> {
    const resolveIds = new Set<number>(roleIds);
    let currentRoleIds = [...roleIds];

    while (currentRoleIds.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: { id: { in: currentRoleIds } },
        select: { id: true, parentId: true },
      });

      const parentIds: number[] = [];
      for (const r of roles) {
        if (r.parentId && !resolveIds.has(r.parentId)) {
          resolveIds.add(r.parentId);
          parentIds.push(r.parentId);
        }
      }
      currentRoleIds = parentIds;
    }

    return Array.from(resolveIds);
  }

  private async getPermissionsForRoles(roleIds: number[]): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      select: {
        permission: {
          select: { name: true },
        },
      },
    });

    const permNames = rolePermissions.map((rp) => rp.permission.name);
    return Array.from(new Set(permNames));
  }
}
