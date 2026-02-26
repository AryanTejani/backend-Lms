---
description: Use when creating a file upload endpoint, adding image/video upload handling, or integrating with Bunny CDN storage
---

# File Upload Endpoint

When adding a file upload endpoint, create a dedicated upload controller that uses `FileInterceptor` and `StorageService`.

## Upload Controller Template

File: `apps/admin-panel/src/modules/<name>/controllers/upload.controller.ts`

```ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '@app/shared';
import type { Express } from 'express';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Controller('<plural-name>')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp|svg\+xml)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.storageService.upload({
      folder: 'images/<name>',
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    });

    return { url: result.cdnUrl };
  }
}
```

## StorageService API

`StorageService` is provided globally via `StorageModule` (already imported in `app.module.ts`). It uploads files to Bunny CDN Storage.

```ts
// Upload a file
const result = await this.storageService.upload({
  folder: 'images/posts',       // CDN folder path
  fileName: file.originalname,   // Original filename (extension extracted)
  contentType: file.mimetype,    // MIME type
  buffer: file.buffer,           // File buffer
});
// result.cdnUrl → full CDN URL like https://cdn.traderlion.com/images/posts/2025/01/<uuid>.png

// Delete a file
await this.storageService.delete(storagePath);
```

Files are stored at `{folder}/{year}/{month}/{uuidv7}.{ext}` — the service handles unique naming automatically.

## VideoService API

For video-specific operations (Bunny Stream), use `VideoService`:

```ts
import { VideoService } from '@app/shared';

// List videos with pagination
const result = await this.videoService.listVideos({ page: 1, itemsPerPage: 20, search: 'query' });
// result: { items: BunnyVideo[], totalItems, currentPage, itemsPerPage }

// Get a single video
const video = await this.videoService.getVideo(videoId);
// video: { guid, title, length, status, thumbnailUrl, embedUrl, ... }
```

## File Type Regex Patterns

| Type | Regex |
|---|---|
| Images | `/^image\/(jpeg\|png\|gif\|webp\|svg\+xml)$/` |
| Videos | `/^video\/(mp4\|quicktime\|x-msvideo\|webm)$/` |
| Documents | `/^application\/(pdf\|msword\|vnd\.openxmlformats)$/` |

## Module Wiring

The upload controller must be registered in the module's `controllers` array:

```ts
import { Module } from '@nestjs/common';
import { ContentModule } from '@app/content';
import { <Name>Controller } from './controllers/<name>.controller';
import { UploadController } from './controllers/upload.controller';

@Module({
  imports: [ContentModule],
  controllers: [<Name>Controller, UploadController],
})
export class <PluralName>Module {}
```

`StorageModule` is imported globally in `app.module.ts`, so `StorageService` and `VideoService` are available to all modules without additional imports.

## Reference

See these files for complete working examples:
- `apps/admin-panel/src/modules/posts/controllers/upload.controller.ts` — Image upload endpoint
- `libs/shared/src/storage/storage.service.ts` — Bunny CDN storage service
- `libs/shared/src/storage/video.service.ts` — Bunny Stream video service
- `libs/shared/src/storage/storage.module.ts` — Global storage module

## Checklist

- [ ] Upload controller created at `modules/<name>/controllers/upload.controller.ts`
- [ ] `@UseInterceptors(FileInterceptor('file'))` applied to upload method
- [ ] `ParseFilePipe` with `MaxFileSizeValidator` and `FileTypeValidator` configured
- [ ] `StorageService` injected (available globally via `StorageModule`)
- [ ] Upload uses `storageService.upload({ folder, fileName, contentType, buffer })`
- [ ] Returns `{ url: result.cdnUrl }`
- [ ] Upload controller registered in module's `controllers` array
- [ ] File type regex matches only expected MIME types
- [ ] Max file size constant defined at top of file
