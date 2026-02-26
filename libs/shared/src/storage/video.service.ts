import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BunnyStreamLibrary = 'public' | 'private';

interface LibraryConfig {
  apiKey: string;
  libraryId: string;
  cdnHostname: string;
}

export interface BunnyMetaTag {
  property: string;
  value: string;
}

export interface BunnyCaption {
  srclang: string;
  label: string;
}

export interface BunnyChapter {
  title: string;
  start: number;
  end: number;
}

export interface BunnyMoment {
  label: string;
  timestamp: number;
}

export interface BunnyVideo {
  guid: string;
  title: string;
  description: string;
  length: number;
  status: number;
  width: number;
  height: number;
  framerate: number;
  dateUploaded: string;
  storageSize: number;
  views: number;
  isPublic: boolean;
  encodeProgress: number;
  hasMP4Fallback: boolean;
  videoLibraryId: number;
  collectionId: string;
  category: string;
  thumbnailCount: number;
  averageWatchTime: number;
  totalWatchTime: number;
  availableResolutions: string;
  outputCodecs: string;
  thumbnailUrl: string;
  embedUrl: string;
  captions: BunnyCaption[];
  chapters: BunnyChapter[];
  moments: BunnyMoment[];
  metaTags: BunnyMetaTag[];
  transcodingMessages: Array<{ timeStamp: string; level: number; issueCode: number; message: string; value: string }>;
}

export interface BunnyVideoListResponse {
  items: BunnyVideo[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
}

export interface BunnyStatusResponse {
  success: boolean;
  message: string;
  statusCode: number;
}

interface BunnyStreamApiVideo {
  guid: string;
  title: string;
  description: string;
  length: number;
  status: number;
  width: number;
  height: number;
  framerate: number;
  dateUploaded: string;
  storageSize: number;
  views: number;
  isPublic: boolean;
  encodeProgress: number;
  hasMP4Fallback: boolean;
  videoLibraryId: number;
  collectionId: string;
  category: string;
  thumbnailCount: number;
  averageWatchTime: number;
  totalWatchTime: number;
  availableResolutions: string;
  outputCodecs: string;
  captions: BunnyCaption[];
  chapters: BunnyChapter[];
  moments: BunnyMoment[];
  metaTags: BunnyMetaTag[];
  transcodingMessages: Array<{ timeStamp: string; level: number; issueCode: number; message: string; value: string }>;
}

interface BunnyStreamApiListResponse {
  items: BunnyStreamApiVideo[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
}

@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  private readonly configs: Record<BunnyStreamLibrary, LibraryConfig>;
  private readonly baseUrl = 'https://video.bunnycdn.com';

  constructor(private readonly configService: ConfigService) {
    this.configs = {
      public: {
        apiKey: this.configService.get<string>('bunny.streamPublicApiKey') ?? '',
        libraryId: this.configService.get<string>('bunny.streamPublicLibraryId') ?? '',
        cdnHostname: this.configService.get<string>('bunny.streamPublicCdnHostname') ?? '',
      },
      private: {
        apiKey: this.configService.get<string>('bunny.streamPrivateApiKey') ?? '',
        libraryId: this.configService.get<string>('bunny.streamPrivateLibraryId') ?? '',
        cdnHostname: this.configService.get<string>('bunny.streamPrivateCdnHostname') ?? '',
      },
    };
  }

  private getConfig(library: BunnyStreamLibrary): LibraryConfig {
    return this.configs[library];
  }

  async listVideos(
    params: {
      page?: number;
      itemsPerPage?: number;
      search?: string;
      collection?: string;
      orderBy?: string;
    } = {},
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyVideoListResponse> {
    const config = this.getConfig(library);
    const searchParams = new URLSearchParams();

    if (params.page) {
      searchParams.set('page', String(params.page));
    }

    if (params.itemsPerPage) {
      searchParams.set('itemsPerPage', String(params.itemsPerPage));
    }

    if (params.search) {
      searchParams.set('search', params.search);
    }

    if (params.collection) {
      searchParams.set('collection', params.collection);
    }

    if (params.orderBy) {
      searchParams.set('orderBy', params.orderBy);
    }

    const query = searchParams.toString();
    const url = `${this.baseUrl}/library/${config.libraryId}/videos${query ? `?${query}` : ''}`;

    const response = await fetch(url, {
      headers: { AccessKey: config.apiKey },
    });

    if (!response.ok) {
      const body = await response.text();

      this.logger.error(`Bunny Stream list failed: ${response.status} — ${body}`);
      throw new Error(`Failed to list videos from Bunny Stream: ${response.status}`);
    }

    const data = (await response.json()) as BunnyStreamApiListResponse;

    return {
      items: data.items.map((v) => this.mapVideo(v, config)),
      totalItems: data.totalItems,
      currentPage: data.currentPage,
      itemsPerPage: data.itemsPerPage,
    };
  }

  async listAllVideos(library: BunnyStreamLibrary = 'public'): Promise<BunnyVideo[]> {
    const allVideos: BunnyVideo[] = [];
    let page = 1;
    const itemsPerPage = 100;

    while (true) {
      const response = await this.listVideos({ page, itemsPerPage }, library);

      allVideos.push(...response.items);

      if (allVideos.length >= response.totalItems) {
        break;
      }

      page++;
    }

    return allVideos;
  }

  async getVideo(videoId: string, library: BunnyStreamLibrary = 'public'): Promise<BunnyVideo> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}`;

    const response = await fetch(url, {
      headers: { AccessKey: config.apiKey },
    });

    if (!response.ok) {
      const body = await response.text();

      this.logger.error(`Bunny Stream get failed: ${response.status} — ${body}`);
      throw new Error(`Failed to get video from Bunny Stream: ${response.status}`);
    }

    const data = (await response.json()) as BunnyStreamApiVideo;

    return this.mapVideo(data, config);
  }

  async createVideo(
    params: { title: string; collectionId?: string | undefined; thumbnailTime?: number | undefined },
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyVideo> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos`;

    const body: Record<string, unknown> = { title: params.title };

    if (params.collectionId) {
      body.collectionId = params.collectionId;
    }

    if (params.thumbnailTime !== undefined) {
      body.thumbnailTime = params.thumbnailTime;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream create failed: ${response.status} — ${text}`);
      throw new Error(`Failed to create video on Bunny Stream: ${response.status}`);
    }

    const data = (await response.json()) as BunnyStreamApiVideo;

    return this.mapVideo(data, config);
  }

  async updateVideo(
    videoId: string,
    params: {
      title?: string | undefined;
      collectionId?: string | undefined;
      chapters?: BunnyChapter[] | undefined;
      moments?: BunnyMoment[] | undefined;
      metaTags?: BunnyMetaTag[] | undefined;
    },
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream update failed: ${response.status} — ${text}`);
      throw new Error(`Failed to update video on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  async deleteVideo(videoId: string, library: BunnyStreamLibrary = 'public'): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { AccessKey: config.apiKey },
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream delete failed: ${response.status} — ${text}`);
      throw new Error(`Failed to delete video on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  async uploadVideo(
    videoId: string,
    buffer: Buffer,
    options?: { enabledResolutions?: string | undefined } | undefined,
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const searchParams = new URLSearchParams();

    if (options?.enabledResolutions) {
      searchParams.set('enabledResolutions', options.enabledResolutions);
    }

    const query = searchParams.toString();
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}${query ? `?${query}` : ''}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: buffer,
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream upload failed: ${response.status} — ${text}`);
      throw new Error(`Failed to upload video to Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  async reencodeVideo(videoId: string, library: BunnyStreamLibrary = 'public'): Promise<BunnyVideo> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}/reencode`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { AccessKey: config.apiKey },
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream reencode failed: ${response.status} — ${text}`);
      throw new Error(`Failed to reencode video on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyVideo;
  }

  async setThumbnail(
    videoId: string,
    payload: { thumbnailUrl: string } | { buffer: Buffer },
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}/thumbnail`;

    let response: Response;

    if ('thumbnailUrl' in payload) {
      const searchParams = new URLSearchParams();

      searchParams.set('thumbnailUrl', payload.thumbnailUrl);

      response = await fetch(`${url}?${searchParams.toString()}`, {
        method: 'POST',
        headers: { AccessKey: config.apiKey },
      });
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          AccessKey: config.apiKey,
          'Content-Type': 'image/jpeg',
        },
        body: payload.buffer,
      });
    }

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream set thumbnail failed: ${response.status} — ${text}`);
      throw new Error(`Failed to set thumbnail on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  async fetchVideo(
    params: { url: string; headers?: Record<string, string> | undefined; title?: string | undefined },
    query?: { collectionId?: string | undefined; thumbnailTime?: number | undefined } | undefined,
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const searchParams = new URLSearchParams();

    if (query?.collectionId) {
      searchParams.set('collectionId', query.collectionId);
    }

    if (query?.thumbnailTime !== undefined) {
      searchParams.set('thumbnailTime', String(query.thumbnailTime));
    }

    const qs = searchParams.toString();
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/fetch${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream fetch failed: ${response.status} — ${text}`);
      throw new Error(`Failed to fetch video on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  async addCaption(
    videoId: string,
    srclang: string,
    params: { label?: string | undefined; captionsFile?: string | undefined },
    library: BunnyStreamLibrary = 'public',
  ): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}/captions/${srclang}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream add caption failed: ${response.status} — ${text}`);
      throw new Error(`Failed to add caption on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  async deleteCaption(videoId: string, srclang: string, library: BunnyStreamLibrary = 'public'): Promise<BunnyStatusResponse> {
    const config = this.getConfig(library);
    const url = `${this.baseUrl}/library/${config.libraryId}/videos/${videoId}/captions/${srclang}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: { AccessKey: config.apiKey },
    });

    if (!response.ok) {
      const text = await response.text();

      this.logger.error(`Bunny Stream delete caption failed: ${response.status} — ${text}`);
      throw new Error(`Failed to delete caption on Bunny Stream: ${response.status}`);
    }

    return (await response.json()) as BunnyStatusResponse;
  }

  getEmbedUrl(bunnyVideoId: string, library: BunnyStreamLibrary = 'public'): string {
    const config = this.getConfig(library);

    return `https://iframe.mediadelivery.net/embed/${config.libraryId}/${bunnyVideoId}`;
  }

  getPlaybackUrl(bunnyVideoId: string, library: BunnyStreamLibrary = 'public'): string {
    const config = this.getConfig(library);

    // Public library: unsigned HLS URL
    if (library === 'public') {
      return `https://${config.cdnHostname}/${bunnyVideoId}/playlist.m3u8`;
    }

    // Private library: signed HLS URL with 10-minute expiry
    // Uses path-based token with token_path so .ts segments inherit the token prefix
    const tokenAuthKey = this.configService.get<string>('bunny.streamPrivateTokenAuthKey') ?? '';
    const expires = Math.floor(Date.now() / 1000) + 10 * 60;
    const tokenPath = `/${bunnyVideoId}/`;
    const parameterData = `token_path=${tokenPath}`;
    const token = this.signBunnyUrl(tokenAuthKey, tokenPath, expires, parameterData);
    const encodedTokenPath = encodeURIComponent(tokenPath);

    return `https://${config.cdnHostname}/bcdn_token=${token}&token_path=${encodedTokenPath}&expires=${expires}/${bunnyVideoId}/playlist.m3u8`;
  }

  private signBunnyUrl(securityKey: string, signaturePath: string, expires: number, parameterData: string = ''): string {
    const hash = createHash('sha256')
      .update(securityKey + signaturePath + String(expires) + parameterData)
      .digest('base64');

    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private mapVideo(video: BunnyStreamApiVideo, config: LibraryConfig): BunnyVideo {
    return {
      guid: video.guid,
      title: video.title,
      description: video.description,
      length: video.length,
      status: video.status,
      width: video.width,
      height: video.height,
      framerate: video.framerate,
      dateUploaded: video.dateUploaded,
      storageSize: video.storageSize,
      views: video.views,
      isPublic: video.isPublic,
      encodeProgress: video.encodeProgress,
      hasMP4Fallback: video.hasMP4Fallback,
      videoLibraryId: video.videoLibraryId,
      collectionId: video.collectionId,
      category: video.category,
      thumbnailCount: video.thumbnailCount,
      averageWatchTime: video.averageWatchTime,
      totalWatchTime: video.totalWatchTime,
      availableResolutions: video.availableResolutions,
      outputCodecs: video.outputCodecs,
      captions: video.captions ?? [],
      chapters: video.chapters ?? [],
      moments: video.moments ?? [],
      metaTags: video.metaTags ?? [],
      transcodingMessages: video.transcodingMessages ?? [],
      thumbnailUrl: config.cdnHostname ? `https://${config.cdnHostname}/${video.guid}/thumbnail.jpg` : '',
      embedUrl: `https://iframe.mediadelivery.net/embed/${config.libraryId}/${video.guid}`,
    };
  }
}
