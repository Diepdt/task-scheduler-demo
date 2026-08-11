import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import * as ExcelJS from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './dto/create-user.dto';
import { validate } from 'class-validator';
import * as crypto from 'crypto';

export type ImportJobData = {
  previewKey: string;
};

@Processor('import-users')
export class ImportProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
  ) {
    super();
  }

  async process(job: Job<ImportJobData>): Promise<any> {
    const { previewKey } = job.data;
    console.log(`[BullMQ Worker] Bắt đầu import từ key: ${previewKey}`);

    try {
      // 1. Tải file từ MinIO về buffer
      const fileBuffer = await this.minioService.getFileBuffer('excel-logs', previewKey);

      // 2. Đọc file Excel
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer as any);
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('File Excel trống hoặc không đúng định dạng!');
      }

      const rowsData: any[] = [];
      const failedRows: any[] = [];
      const usersToCreate: CreateUserDto[] = [];

      // 1. Đọc và làm sạch toàn bộ dữ liệu Excel
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return; // Bỏ qua header

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

      // 2. Gom dữ liệu để Bulk Query kiểm trùng với DB theo từng lô (Batch size 5000)
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

      // Tập hợp theo dõi trùng lặp nội bộ trong chính file Excel
      const seenEmails = new Set<string>();
      const seenPhones = new Set<string>();

      // 3. Thực hiện kiểm tra lỗi và phân loại
      for (const r of rowsData) {
        const userDto = plainToInstance(CreateUserDto, {
          email: r.email,
          password: r.password,
          name: r.name,
          phone: r.phone,
          roles: r.role ? [r.role] : []
        });
        const errors = await validate(userDto);

        if (errors.length > 0) {
          const errorMsg = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
          failedRows.push({ email: r.email, password: r.password, name: r.name, phone: r.phone, role: r.role, errorReason: errorMsg });
        } else {
          // Check trùng nội bộ file Excel
          if (seenEmails.has(r.email)) {
            failedRows.push({ email: r.email, password: r.password, name: r.name, phone: r.phone, role: r.role, errorReason: 'Email bị trùng lặp trong file Excel' });
            continue;
          }
          if (seenPhones.has(r.phone)) {
            failedRows.push({ email: r.email, password: r.password, name: r.name, phone: r.phone, role: r.role, errorReason: 'Số điện thoại bị trùng lặp trong file Excel' });
            continue;
          }

          // Check trùng với CSDL
          const hasDupEmail = existingEmailsSet.has(r.email);
          const hasDupPhone = existingPhonesSet.has(r.phone);

          if (hasDupEmail) {
            failedRows.push({ email: r.email, password: r.password, name: r.name, phone: r.phone, role: r.role, errorReason: 'Email đã tồn tại' });
          } else if (hasDupPhone) {
            failedRows.push({ email: r.email, password: r.password, name: r.name, phone: r.phone, role: r.role, errorReason: 'Số điện thoại đã tồn tại' });
          } else {
            // Đánh dấu đã quét qua để tránh trùng lặp nội bộ các dòng sau
            seenEmails.add(r.email);
            seenPhones.add(r.phone);
            usersToCreate.push(userDto);
          }
        }
      }

      // 4. Thực hiện Bulk Insert gộp hàng loạt các bản ghi hợp lệ theo từng lô (Batch size 5000)
      let successCount = 0;
      if (usersToCreate.length > 0) {
        const dbRoles = await this.prisma.role.findMany({});
        const roleMap = dbRoles.reduce((acc, r) => {
          acc[r.name] = r.id;
          return acc;
        }, {} as Record<string, number>);

        const usersWithHashedPassword = usersToCreate.map(u => {
          const hashedPassword = crypto.createHash('sha256').update(u.password).digest('hex');
          return {
            ...u,
            password: hashedPassword,
          };
        });

        for (let i = 0; i < usersWithHashedPassword.length; i += batchSize) {
          const chunk = usersWithHashedPassword.slice(i, i + batchSize);
          
          // Loại bỏ mảng roles trước khi truyền vào database User model
          const usersDataOnly = chunk.map(({ roles, ...rest }) => rest);

          const insertResult = await this.prisma.user.createMany({
            data: usersDataOnly,
            skipDuplicates: true, // Bảo vệ toàn vẹn dữ liệu đề phòng race condition
          });
          successCount += insertResult.count;

          const chunkEmails = chunk.map(u => u.email);
          const dbUsers = await this.prisma.user.findMany({
            where: { email: { in: chunkEmails } },
            select: { id: true, email: true }
          });

          const userRolesData: any[] = [];
          for (const dbUser of dbUsers) {
            const originalUser = chunk.find(u => u.email === dbUser.email);
            if (originalUser && originalUser.roles) {
              for (const rName of originalUser.roles) {
                const roleId = roleMap[rName];
                if (roleId) {
                  userRolesData.push({
                    userId: dbUser.id,
                    roleId: roleId
                  });
                }
              }
            }
          }

          if (userRolesData.length > 0) {
            await this.prisma.userRole.createMany({
              data: userRolesData,
              skipDuplicates: true
            });
          }
        }

        // Nếu số lượng thành công ít hơn mong đợi, ghi nhận các dòng lỗi do race condition
        if (successCount < usersToCreate.length) {
          const diff = usersToCreate.length - successCount;
          console.warn(`[BullMQ Worker] Phát hiện ${diff} bản ghi bị bỏ qua do trùng khóa chính (Race Condition).`);
        }
      }

      console.log(`[BullMQ Worker] Import thành công: ${successCount} users. Thất bại: ${failedRows.length} users.`);

      // 4. Nếu có dòng lỗi thì lưu file lỗi mới cập nhật (tùy chọn)
      let errorUrl: string | undefined = undefined;
      if (failedRows.length > 0) {
        const errorWorkbook = new ExcelJS.Workbook();
        const errorSheet = errorWorkbook.addWorksheet('Lỗi Import');
        errorSheet.addRow(['Email', 'Mật khẩu', 'Tên', 'Số điện thoại', 'Quyền (Role)', 'Lý do lỗi']);
        failedRows.forEach(r => {
          errorSheet.addRow([r.email, r.password, r.name, r.phone, r.role, r.errorReason]);
        });

        const errorBuffer = (await errorWorkbook.xlsx.writeBuffer()) as any;
        const fileName = `import-errors/errors-confirm-${Date.now()}.xlsx`;
        await this.minioService.uploadFile('excel-logs', fileName, errorBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        errorUrl = await this.minioService.getPresignedUrl('excel-logs', fileName);
      }

      return {
        successCount,
        errorCount: failedRows.length,
        errorUrl,
        errors: failedRows.map((r, idx) => ({
          row: idx + 2,
          email: r.email,
          name: r.name,
          phone: r.phone,
          role: r.role,
          reason: r.errorReason,
        })),
      };
    } catch (error: any) {
      console.error(`[BullMQ Worker] Lỗi xử lý import: ${error.message}`);
      throw error;
    }
  }
}
