import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập hệ thống bằng email và mật khẩu' })
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  // Route 1: Kích hoạt chuyển hướng sang Google
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) { }

  // Route 2: Tiếp nhận callback từ Google sau khi đăng nhập thành công
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res) {
    // req.user chứa thông tin từ hàm validate() của GoogleStrategy
    const result = await this.authService.validateGoogleUser(req.user);

    // Gửi token và thông tin user về giao diện Frontend qua URL Query Parameters
    const token = result.access_token;
    const userStr = encodeURIComponent(JSON.stringify(result.user));
    res.redirect(`/index.html?token=${token}&user=${userStr}`);
  }
}
