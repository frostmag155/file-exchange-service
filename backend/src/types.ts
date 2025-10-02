import { Request } from 'express';

export interface FileMetadata {
  id: string;
  originalName: string;
  uploadDate: Date;
  lastDownload: Date | null;
  downloadCount: number;
}

export interface AuthRequest extends Request {
  headers: {
    authorization?: string;
  };
}

export interface UploadResponse {
  success: boolean;
  fileId: string;
  downloadUrl: string;
}