import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Readable } from 'node:stream';
import { generateUuidV7 } from '../utils/uuid.util';

export type BunnyStorageZone = 'public' | 'private';

interface UploadParams {
  folder: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
}

interface UploadResult {
  cdnUrl: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('cloudinary.cloudName') ?? '',
      api_key: this.configService.get<string>('cloudinary.apiKey') ?? '',
      api_secret: this.configService.get<string>('cloudinary.apiSecret') ?? '',
    });
  }

  async upload({ folder, fileName, buffer }: UploadParams, _zone: BunnyStorageZone = 'public'): Promise<UploadResult> {
    const ext = this.extractExtension(fileName);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uniqueName = `${generateUuidV7()}${ext}`;
    const cloudinaryFolder = `${folder}/${year}/${month}`;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: cloudinaryFolder,
          public_id: uniqueName.replace(/\.[^.]+$/, ''),
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            reject(error);

            return;
          }

          resolve(result!);
        },
      );

      const readable = Readable.from(buffer);

      readable.pipe(uploadStream);
    });

    this.logger.log(`Uploaded ${cloudinaryFolder}/${uniqueName} (${buffer.length} bytes) to Cloudinary`);

    return { cdnUrl: result.secure_url };
  }

  async delete(storagePath: string, _zone: BunnyStorageZone = 'public'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(storagePath);
    } catch (error) {
      this.logger.error(`Cloudinary delete failed for ${storagePath}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private extractExtension(fileName: string): string {
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex === -1) {
      return '';
    }

    return fileName.slice(dotIndex).toLowerCase();
  }
}
