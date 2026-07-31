import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import * as ExcelJS from 'exceljs';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './dto/create-user.dto';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
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

      const usersToCreate: CreateUserDto[] = [];
      const failedRows: any[] = [];
      const promises: Promise<void>[] = [];

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
        const role = cleanCellText(row.getCell(5)) as Role;

        const p = (async () => {
          const userDto = plainToInstance(CreateUserDto, { email, password, name, phone, role });
          const errors = await validate(userDto);

          if (errors.length > 0) {
            const errorMsg = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
            failedRows.push({ email, password, name, phone, role, errorReason: errorMsg });
          } else {
            // Kiểm tra email và số điện thoại trùng
            const existingEmail = await this.prisma.user.findUnique({
              where: { email },
            });
            const existingPhone = await this.prisma.user.findUnique({
              where: { phone },
            });

            if (existingEmail) {
              failedRows.push({ email, password, name, phone, role, errorReason: 'Email đã tồn tại' });
            } else if (existingPhone) {
              failedRows.push({ email, password, name, phone, role, errorReason: 'Số điện thoại đã tồn tại' });
            } else {
              usersToCreate.push(userDto);
            }
          }
        })();
        promises.push(p);
      });

      await Promise.all(promises);

      // 3. Lưu các bản ghi hợp lệ
      let successCount = 0;
      for (const userData of usersToCreate) {
        // Kiểm tra lại đề phòng race conditions
        const dupEmail = await this.prisma.user.findUnique({ where: { email: userData.email } });
        const dupPhone = await this.prisma.user.findUnique({ where: { phone: userData.phone } });
        if (!dupEmail && !dupPhone) {
          const hashedPassword = crypto.createHash('sha256').update(userData.password).digest('hex');
          await this.prisma.user.create({
            data: {
              ...userData,
              password: hashedPassword,
            },
          });
          successCount++;
        } else {
          failedRows.push({ ...userData, errorReason: 'Email hoặc Số điện thoại đã tồn tại (Race Condition)' });
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
