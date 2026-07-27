import { Injectable } from '@nestjs/common';
import { PostgresPrismaService } from './postgres-prisma.service';

@Injectable()
export class PrismaService extends PostgresPrismaService {}
