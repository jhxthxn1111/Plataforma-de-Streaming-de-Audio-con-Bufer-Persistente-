import { Router, Request, Response, NextFunction } from 'express';
import { AudioService } from '../services/audio.service';

const router = Router();
const audioService = new AudioService();

router.get('/tracks', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const tracks = await audioService.getLocalCatalog();
        res.status(200).json({ success: true, tracks });
    } catch (error) {
        next(error);
    }
});

// NUEVO: Genera un ticket temporal (aquí iría el middleware de sesión en el futuro)
router.get('/ticket/:fileName', (req: Request, res: Response) => {
    const fileName = req.params.fileName as string;
    const queryParams = audioService.generateSignedUrl(fileName);
    res.status(200).json({ 
        success: true, 
        ticketUrl: `/api/audio/stream/${encodeURIComponent(fileName)}${queryParams}` 
    });
});

router.get('/stream/:fileName', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const fileName = req.params.fileName as string;
        const { expires, signature } = req.query;

        // NUEVO: Validación estricta de la URL firmada
        if (!expires || !signature || typeof expires !== 'string' || typeof signature !== 'string') {
            res.status(401).json({ success: false, message: 'Falta firma de seguridad. Acceso denegado.' });
            return;
        }

        if (!audioService.verifySignature(fileName, expires, signature)) {
            res.status(401).json({ success: false, message: 'URL expirada o firma inválida.' });
            return;
        }

        const range = req.headers.range as string | undefined;
        const result = await audioService.getAudioStream(fileName, range);

        res.writeHead(result.statusCode, result.headers);
        result.stream.pipe(res);

        result.stream.on('error', (err: any) => {
            if (!res.headersSent) next(err);
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