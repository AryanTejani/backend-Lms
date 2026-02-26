import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateUuidV7 } from '../utils/uuid.util';

export type BunnyStorageZone = 'public' | 'private';

interface ZoneConfig {
  apiKey: string;
  zone: string;
  endpoint: string;
  cdnBaseUrl: string;
}

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
  private readonly configs: Record<BunnyStorageZone, ZoneConfig>;

  constructor(private readonly configService: ConfigService) {
    this.configs = {
      public: {
        apiKey: this.configService.get<string>('bunny.storagePublicApiKey') ?? '',
        zone: this.configService.get<string>('bunny.storagePublicZone') ?? 'traderlion-media',
        endpoint: this.configService.get<string>('bunny.storagePublicEndpoint') ?? 'https://ny.storage.bunnycdn.com',
        cdnBaseUrl: this.configService.get<string>('bunny.storagePublicCdnBaseUrl') ?? 'https://vz-a9f12ba5-5bf.b-cdn.net',
      },
      private: {
        apiKey: this.configService.get<string>('bunny.storagePrivateApiKey') ?? '',
        zone: this.configService.get<string>('bunny.storagePrivateZone') ?? '',
        endpoint: this.configService.get<string>('bunny.storagePrivateEndpoint') ?? 'https://ny.storage.bunnycdn.com',
        cdnBaseUrl: this.configService.get<string>('bunny.storagePrivateCdnBaseUrl') ?? '',
      },
    };
  }

  private getConfig(zone: BunnyStorageZone): ZoneConfig {
    return this.configs[zone];
  }

  /**
   * Upload a file to Bunny CDN Storage.
   *
   * The file is stored at `{folder}/{year}/{month}/{uuidv7}.{ext}`.
   */
  async upload({ folder, fileName, contentType, buffer }: UploadParams, zone: BunnyStorageZone = 'public'): Promise<UploadResult> {
    const config = this.getConfig(zone);
    const ext = this.extractExtension(fileName);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uniqueName = `${generateUuidV7()}${ext}`;
    const storagePath = `${folder}/${year}/${month}/${uniqueName}`;

    const url = `${config.endpoint}/${config.zone}/${storagePath}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!response.ok) {
      const body = await response.text();

      this.logger.error(`Bunny upload failed: ${response.status} — ${body}`);
      throw new Error(`Failed to upload to Bunny CDN: ${response.status}`);
    }

    const cdnUrl = `${config.cdnBaseUrl}/${storagePath}`;

    this.logger.log(`Uploaded ${storagePath} (${buffer.length} bytes) to ${zone} zone`);

    return { cdnUrl };
  }

  /**
   * Delete a file from Bunny CDN Storage.
   */
  async delete(storagePath: string, zone: BunnyStorageZone = 'public'): Promise<void> {
    const config = this.getConfig(zone);
    const url = `${config.endpoint}/${config.zone}/${storagePath}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { AccessKey: config.apiKey },
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text();

      this.logger.error(`Bunny delete failed: ${response.status} — ${body}`);
      throw new Error(`Failed to delete from Bunny CDN: ${response.status}`);
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
