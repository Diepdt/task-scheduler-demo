import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async sendBirthdayWish(email: string, userName: string) {
        try {
            await this.mailerService.sendMail({
                to: email,
                subject: 'Chúc Mừng Sinh Nhật! 🎂🎉',
                html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px; max-width: 600px;">
            <h2 style="color: #e91e63;">Chúc mừng sinh nhật, ${userName}! 🎂</h2>
            <p>Chào ${userName},</p>
            <p>Đội ngũ chúng tôi xin gửi những lời chúc mừng ấm áp và tốt đẹp nhất đến bạn trong ngày đặc biệt này. Chúc bạn một tuổi mới ngập tràn niềm vui, hạnh phúc và thành công rực rỡ!</p>
            <br/>
            <p>Trân trọng,</p>
            <p><strong>Đội ngũ vận hành hệ thống</strong></p>
          </div>
        `,
            });
            this.logger.log(`Đã gửi email chúc mừng sinh nhật thành công tới: ${email}`);
        } catch (error) {
            this.logger.error(`Lỗi khi gửi email tới ${email}:`, error);
        }
    }
}
