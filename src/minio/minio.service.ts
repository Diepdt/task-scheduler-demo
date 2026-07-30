import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private minioClient!: Minio.Client;

  onModuleInit() {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadminpassword',
    });
  }

  // Kiểm tra bucket đã tồn tại chưa, nếu chưa thì tạo mới
  async checkOrCreateBucket(bucketName: string): Promise<void> {
    const exists = await this.minioClient.bucketExists(bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(bucketName);
      console.log(`[MinIO] Bucket "${bucketName}" đã được tạo thành công.`);
    }
  }

  // Tải file lên MinIO từ Buffer
  async uploadFile(
    bucketName: string,
    objectName: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    await this.checkOrCreateBucket(bucketName);
    await this.minioClient.putObject(bucketName, objectName, fileBuffer, fileBuffer.length, {
      'Content-Type': mimeType,
    });
    return objectName;
  }

  // Lấy link tải file (Presigned URL) có thời hạn
  async getPresignedUrl(bucketName: string, objectName: string, expiryInSeconds = 3600): Promise<string> {
    return this.minioClient.presignedGetObject(bucketName, objectName, expiryInSeconds);
  }

  // Tải file từ MinIO về Buffer
  async getFileBuffer(bucketName: string, objectName: string): Promise<Buffer> {
    const stream = await this.minioClient.getObject(bucketName, objectName);
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', err => reject(err));
    });
  }
}
