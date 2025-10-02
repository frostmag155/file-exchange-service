import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { FileMetadata, AuthRequest, UploadResponse } from './types';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Создаем папку для загрузок если её нет
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const fileId = uuidv4();
    cb(null, fileId + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// хранилище для метаданных файлов
const fileMetadata = new Map<string, FileMetadata>();

//статистика для существующих файлов 
function restoreFileMetadata(): void {
  try {
    if (!fs.existsSync(uploadsDir)) return;
    
    const files = fs.readdirSync(uploadsDir);
    files.forEach(filename => {
      const fileId = path.parse(filename).name;
      
      // если метаданных нет, создаем базовые
      if (!fileMetadata.has(fileId)) {
        fileMetadata.set(fileId, {
          id: fileId,
          originalName: filename,
          uploadDate: new Date(),
          lastDownload: null,
          downloadCount: 0
        });
      }
    });
    console.log(`📊 Восстановлено ${files.length} файлов в статистике`);
  } catch (error) {
    console.error('Ошибка восстановления статистики:', error);
  }
}

//авторизация
const checkAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (authHeader === 'Bearer admin-token') {
    next();
  } else {
    res.status(401).json({ error: 'Не авторизован' });
  }
};

//загрузка файла
app.post('/api/upload', checkAuth, upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    const fileId = path.parse(req.file.filename).name;
    
      fileMetadata.set(fileId, {
      id: fileId,
      originalName: req.file.originalname,
      uploadDate: new Date(),
      lastDownload: null,
      downloadCount: 0
    });

    const response: UploadResponse = {
      success: true,
      fileId: fileId,
      downloadUrl: `http://localhost:${PORT}/api/download/${fileId}`
    };

    res.json(response);
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    res.status(500).json({ error: 'Ошибка загрузки' });
  }
});

//скачивание
app.get('/api/download/:fileId', (req: Request, res: Response) => {
  try {
    const fileId = req.params.fileId;
    const metadata = fileMetadata.get(fileId);

    if (!metadata) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    metadata.lastDownload = new Date();
    metadata.downloadCount += 1;
    fileMetadata.set(fileId, metadata);

    const files = fs.readdirSync(uploadsDir);
    const file = files.find(f => f.startsWith(fileId));
    
    if (!file) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    const filePath = path.join(uploadsDir, file);
    res.download(filePath, metadata.originalName);
  } catch (error) {
    console.error('Ошибка скачивания:', error);
    res.status(500).json({ error: 'Ошибка скачивания' });
  }
});

app.get('/api/stats', checkAuth, (req: Request, res: Response) => {
  const stats = Array.from(fileMetadata.values());
  res.json(stats);
});

// очистка файлов 
setInterval(() => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  let deletedCount = 0;
  
  fileMetadata.forEach((metadata, fileId) => {
    const lastDownload = metadata.lastDownload || metadata.uploadDate;
    
    if (lastDownload < thirtyDaysAgo) {
      // Удаляем файл
      const files = fs.readdirSync(uploadsDir);
      const file = files.find(f => f.startsWith(fileId));
      
      if (file) {
        const filePath = path.join(uploadsDir, file);
        fs.unlinkSync(filePath);
        fileMetadata.delete(fileId);
        deletedCount++;
        console.log(`🗑️ Удален старый файл: ${metadata.originalName}`);
      }
    }
  });
  
  if (deletedCount > 0) {
    console.log(`✅ Удалено ${deletedCount} старых файлов`);
  }
}, 24 * 60 * 60 * 1000); // раз в день

restoreFileMetadata();

// запуск сервака
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Файлы сохраняются в: ${uploadsDir}`);
  console.log('Очистка старых файлов активирована (30 дней без скачивания)');
});