import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { create } from 'domain';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) { }

  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async register(dto: CreateUserDto) {
    const { roles, ...userDto } = dto;
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: userDto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email này đã được sử dụng!');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: userDto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Số điện thoại này đã được sử dụng!');
    }

    const hashedPassword = this.hashPassword(userDto.password);

    const roleNames = roles && roles.length > 0 ? roles : ['USER'];
    const dbRoles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    const user = await this.prisma.user.create({
      data: {
        ...userDto,
        password: hashedPassword,
        userRoles: {
          create: dbRoles.map((r) => ({
            roleId: r.id,
          })),
        },
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async generateTokens(payload: any) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_SECRET || 'super-secret-key-12345',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-67890',
        expiresIn: '7d',
      }),
    ]);

    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  async login(body: any) {
    const { email, password } = body;
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc Mật khẩu không chính xác!');
    }

    const hashedPassword = this.hashPassword(password);
    if (user.password !== hashedPassword) {
      throw new UnauthorizedException('Email hoặc Mật khẩu không chính xác!');
    }

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const payload = { sub: user.id, email: user.email, roles: roleNames };
    const tokens = await this.generateTokens(payload);
    const permissions = await this.userService.getUserPermissions(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: roleNames,
        permissions,
      },
    };
  }

  async validateGoogleUser(googleProfile: any) {
    const { email, googleId, firstName, lastName } = googleProfile;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleId }],
      },
      include: { userRoles: { include: { role: true } } }
    });

    if (user) {
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
          include: { userRoles: { include: { role: true } } }
        });
      }
    } else {
      const fullName = `${lastName || ''} ${firstName || ''}`.trim() || 'Google User';
      const randomPhone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;

      const defaultRole = await this.prisma.role.findUnique({
        where: { name: 'USER' },
      });

      user = await this.prisma.user.create({
        data: {
          email,
          name: fullName,
          phone: randomPhone,
          googleId,
          userRoles: defaultRole ? { create: { roleId: defaultRole.id } } : undefined
        },
        include: { userRoles: { include: { role: true } } }
      });
    }

    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const payload = { sub: user.id, email: user.email, roles: roleNames };
    const tokens = await this.generateTokens(payload);
    const permissions = await this.userService.getUserPermissions(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: roleNames,
        permissions,
      }
    };
  }

  async refreshTokens(refresh_token: string) {
    try {
      // xác thực refreshToken
      const payload = await this.jwtService.verifyAsync(refresh_token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // tìm user trong db
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { userRoles: { include: { role: true } } },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException("Truy cập bị từ chối!");
      }

      // Kiểm tra xem refresh token có khớp với db k
      const hashedRt = crypto.createHash('sha256').update(refresh_token).digest('hex');
      if (user.refreshToken !== hashedRt) {
        throw new UnauthorizedException("Truy cập bị từ chối!");
      }

      // sinh cặp tokens mới, xoay vòng token
      const roleNames = user.userRoles.map((ur) => ur.role.name);
      const newPayload = { sub: user.id, email: user.email, roles: roleNames };
      const tokens = await this.generateTokens(newPayload);
      return tokens;
    } catch (error) {
      throw new UnauthorizedException("Phiên đăng nhập hết hạn hoặc không hợp lệ");
    }
  }

  async logout(userId: number) {
    // xóa refresh token trong db khi logout
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    })
  };
}

