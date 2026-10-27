import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface AudioStreamResult {
    stream: fs.ReadStream;
    headers: Record<string, string | number>;
    statusCode: number;
}

export interface LocalTrackMetadata {
    id: string;
    title: string;
    artist: string;
    album: string;
    fileName: string;
    sizeBytes: number;
    coverGradient: string;
    accentColor: string;
}

export class AudioService {
    // Clave secreta para firmar las URLs (en producción iría en el .env)
    private readonly SECRET_KEY = process.env.AUDIO_SECRET_KEY || 'usc_ingenieria_secreta_2026';

    private getStorageDir(): string {
        const cwdStorage = path.resolve(process.cwd(), 'storage');
        if (fs.existsSync(cwdStorage)) {
            return cwdStorage;
        }
        return path.resolve(__dirname, '../../storage');
    }

    private resolveAudioPath(fileName: string): string {
        const safeFileName = path.basename(fileName);
        return path.join(this.getStorageDir(), safeFileName);
    }

    private formatTrackTitle(fileName: string, index: number): string {
        const base = fileName.replace(/\.mp3$/i, '').trim();
        if (base.toLowerCase() === 'cancion') return 'Canción 1';
        const match = base.match(/^cancion\s*(\d+)$/i);
        if (match && match[1]) return `Canción ${match[1]}`;
        const cleaned = base.replace(/[-_]+/g, ' ');
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || `Canción ${index + 1}`;
    }

    // NUEVO: Genera una URL firmada válida por 5 minutos
    public generateSignedUrl(fileName: string): string {
        const expiration = Date.now() + 5 * 60 * 1000; // 5 minutos
        const dataToSign = `${fileName}:${expiration}`;
        const signature = crypto.createHmac('sha256', this.SECRET_KEY).update(dataToSign).digest('hex');
        return `?expires=${expiration}&signature=${signature}`;
    }

    // NUEVO: Verifica que el token no haya sido alterado ni esté caducado
    public verifySignature(fileName: string, expires: string, signature: string): boolean {
        if (Date.now() > parseInt(expires, 10)) return false; // Expiró
        const dataToSign = `${fileName}:${expires}`;
        const expectedSignature = crypto.createHmac('sha256', this.SECRET_KEY).update(dataToSign).digest('hex');
        
        try {
            const a = Buffer.from(signature);
            const b = Buffer.from(expectedSignature);
            return a.length === b.length && crypto.timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }

    public async getLocalCatalog(): Promise<LocalTrackMetadata[]> {
        const storageDir = this.getStorageDir();
        try {
            await fs.promises.access(storageDir, fs.constants.F_OK);
        } catch {
            return [];
        }

        const files = await fs.promises.readdir(storageDir);
        const mp3Files = files
            .filter((f) => f.toLowerCase().endsWith('.mp3'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const palettes = [
            { gradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)', accent: '#a855f7' },
            { gradient: 'linear-gradient(135deg, #450a0a 0%, #dc2626 55%, #f97316 100%)', accent: '#ef4444' },
            { gradient: 'linear-gradient(135deg, #042f2e 0%, #0d9488 55%, #22d3ee 100%)', accent: '#14b8a6' },
            { gradient: 'linear-gradient(135deg, #0f172a 0%, #2563eb 55%, #818cf8 100%)', accent: '#3b82f6' },
            { gradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 55%, #a3e635 100%)', accent: '#22c55e' },
        ];

        const catalog: LocalTrackMetadata[] = [];
        for (let i = 0; i < mp3Files.length; i++) {
            const fileName = mp3Files[i] ?? 'cancion.mp3';
            const fullPath = path.join(storageDir, fileName);
            let sizeBytes = 0;
            try {
                const stat = await fs.promises.stat(fullPath);
                sizeBytes = stat.size;
            } catch {
                sizeBytes = 0;
            }

         const palette = palettes[i % palettes.length] || { gradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)', accent: '#a855f7' };
            catalog.push({
                id: `local-track-${i + 1}`,
                title: this.formatTrackTitle(fileName, i),
                artist: `Archivo local (${fileName})`,
                album: 'Búfer Persistente • Storage Local',
                fileName,
                sizeBytes,
                coverGradient: palette.gradient,
                accentColor: palette.accent,
            });
        }
        return catalog;
    }

    public async getAudioStream(fileName: string, range?: string): Promise<AudioStreamResult> {
        const audioPath = this.resolveAudioPath(fileName);
        try {
            await fs.promises.access(audioPath, fs.constants.F_OK);
        } catch {
            throw new Error('FILE_NOT_FOUND');
        }

        const stat = await fs.promises.stat(audioPath);
        const fileSize = stat.size;
        const baseHeaders: Record<string, string | number> = {
            'Accept-Ranges': 'bytes',
            'Content-Type': 'audio/mpeg',
            'Cross-Origin-Resource-Policy': 'cross-origin',
            'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
            'Cache-Control': 'no-cache',
        };

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0] || '0', 10);
            const maxChunk = 1024 * 1024;
            const requestedEnd = parts[1] ? parseInt(parts[1] as string, 10) : Math.min(start + maxChunk, fileSize - 1);
            const end = Math.min(requestedEnd, fileSize - 1);

            if (isNaN(start) || isNaN(end) || start >= fileSize || start > end) {
                throw new Error('RANGE_NOT_SATISFIABLE');
            }

            const chunksize = (end - start) + 1;
            const stream = fs.createReadStream(audioPath, { start, end });

            return {
                statusCode: 206,
                headers: {
                    ...baseHeaders,
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Content-Length': chunksize,
                },
                stream,
            };
        }

        const stream = fs.createReadStream(audioPath);
        return {
            statusCode: 200,
            headers: { ...baseHeaders, 'Content-Length': fileSize },
            stream,
        };
    }
}