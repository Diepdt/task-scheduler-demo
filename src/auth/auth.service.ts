import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { create } from 'domain';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: roleNames,
      },
    };
  }

  async validateGoogleUser(googleProfile: any) {
    const { email, googleId, firstName, lastName } = googleProfile;

    // 1. Tìm user theo email hoặc googleId
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { googleId }],
      },
      include: { userRoles: { include: { role: true } } }
    });

    // 2. Nếu đã có tài khoản
    if (user) {
      // Nếu chưa liên kết googleId thì cập nhật liên kết
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { googleId },
          include: { userRoles: { include: { role: true } } }
        });
      }
    } else {
      // 3. Nếu CHƯA CÓ tài khoản thì mới tạo mới (Đây là else của if (user))
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

    // 4. Trả về JWT token đăng nhập
    const roleNames = user.userRoles.map((ur) => ur.role.name);
    const payload = { sub: user.id, email: user.email, roles: roleNames };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: roleNames
      }
    };
  }
}

