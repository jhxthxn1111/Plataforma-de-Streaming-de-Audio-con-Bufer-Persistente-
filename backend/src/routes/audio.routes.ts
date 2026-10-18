import { Router, Request, Response, NextFunction } from 'express';
import { AudioService } from '../services/audio.service';

const router = Router();
const audioService = new AudioService();

// 1. Obtener catálogo dinámico de canciones desde storage/
router.get('/tracks', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const tracks = await audioService.getLocalCatalog();
        res.status(200).json({ success: true, tracks });
    } catch (error) {
        next(error);
    }
});

// 2. Streaming HTTP 206 Partial Content para el búfer persistente
router.get('/stream/:fileName', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fileName = req.params.fileName as string;
        const range = req.headers.range as string | undefined;

        const result = await audioService.getAudioStream(fileName, range);

        res.writeHead(result.statusCode, result.headers);
        result.stream.pipe(res);

        result.stream.on('error', (err: any) => {
            console.error('Error en el stream de audio:', err);
            if (!res.headersSent) {
                next(err);
            }
        });
    } catch (error: any) {
        if (error.message === 'FILE_NOT_FOUND') {
            res.status(404).json({ success: false, message: 'Audio no encontrado en storage.' });
            return;
        }
        if (error.message === 'RANGE_NOT_SATISFIABLE') {
            res.status(416).json({ success: false, message: 'Rango de bytes no válido.' });
            return;
        }
        next(error);
    }
});

export default router;