import { Controller, Post, Body, Get, UseGuards, Req, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response, Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard as CustomAuthGuard } from '../common/guards/auth.guard';

// helper ghi lại refresh token vào cookie của trình duyệt
const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('refresh_token', token, {
    httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) { }

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập hệ thống bằng email và mật khẩu' })
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body);

    // Ghi refresh_token vào Cookie
    setRefreshTokenCookie(res, result.refreshToken);

    // Chỉ trả về access_token và user info cho frontend (không trả về refresh_token ở body)
    return {
      access_token: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy Refresh Token!');
    }
    const result = await this.authService.refreshTokens(refreshToken);

    // Đổi mới refresh_token trong cookie, Xoay vòng token
    setRefreshTokenCookie(res, result.refreshToken);

    return { access_token: result.accessToken };
  }

  @Post('logout')
  @UseGuards(CustomAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req as any).user?.id;
    if (userId) {
      await this.authService.logout(userId);
    }

    // Xóa cookie của trình duyệt
    res.clearCookie('refresh_token');
    return { message: 'Đăng xuất thành công!' };
  }

  // Kích hoạt chuyển hướng sang Google
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) { }

  // Tiếp nhận callback từ Google sau khi đăng nhập thành công
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    // req.user chứa thông tin từ hàm validate() của GoogleStrategy
    const result = await this.authService.validateGoogleUser(req.user);

    // Ghi refresh_token vào Cookie
    setRefreshTokenCookie(res, result.refreshToken);

    // Gửi token và thông tin user về giao diện Frontend qua URL Query Parameters
    const token = result.accessToken;
    const userStr = encodeURIComponent(JSON.stringify(result.user));
    res.redirect(`/index.html?token=${token}&user=${userStr}`);
  }
}