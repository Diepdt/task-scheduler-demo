import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { CreateUserDto } from '../user/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async register(dto: CreateUserDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email này đã được sử dụng!');
    }

    const existingPhone = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException('Số điện thoại này đã được sử dụng!');
    }

    const hashedPassword = this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async login(body: any) {
    const { email, password } = body;
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc Mật khẩu không chính xác!');
    }

    const hashedPassword = this.hashPassword(password);
    if (user.password !== hashedPassword) {
      throw new UnauthorizedException('Email hoặc Mật khẩu không chính xác!');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
