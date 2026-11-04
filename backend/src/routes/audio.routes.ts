import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { authenticate } from '../middlewares/authenticate';
import { AudioError, AudioService } from '../services/audio.service';
import { logger } from '../utils/logger';
import { streamMetrics } from '../utils/stream-metrics';

const router = Router();
const audioService = new AudioService();

const audioLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
    handler: (_req, _res, next) => next(new AppError(429, 'rate_limited', 'Demasiadas peticiones. Espera un momento.')),
});

/** Traduce los errores del streaming al formato { code, message } que ya interpreta el frontend. */
function toHttpError(error: unknown): unknown {
    if (error instanceof AudioError) {
        if (error.code === 'FILE_NOT_FOUND') return new AppError(404, 'track_not_found', 'Audio no encontrado en storage.');
        return new AppError(416, 'range_not_satisfiable', 'Rango de bytes no válido.');
    }
    return error;
}

// El catálogo y los tickets exigen sesión. El streaming en sí no lleva Authorization (<audio> no puede enviarlo):
// se protege con la URL firmada y temporal que solo entrega /ticket a quien tiene sesión.
router.get('/tracks', authenticate, audioLimiter, async (_req: Request, res: Response) => {
    const tracks = await audioService.getLocalCatalog();
    res.status(200).json({ success: true, tracks });
});

router.get('/ticket/:fileName', authenticate, audioLimiter, (req: Request, res: Response) => {
    const fileName = req.params.fileName as string;
    const queryParams = audioService.generateSignedUrl(fileName);
    res.status(200).json({
        success: true,
        ticketUrl: `/api/audio/stream/${encodeURIComponent(fileName)}${queryParams}`,
    });
});

router.get('/stream/:fileName', async (req: Request, res: Response, next: NextFunction) => {
    const fileName = req.params.fileName as string;
    const { expires, signature } = req.query;

    if (typeof expires !== 'string' || typeof signature !== 'string' || !expires || !signature) {
        next(new AppError(401, 'invalid_signature', 'Falta la firma de seguridad. Acceso denegado.'));
        return;
    }
    if (!audioService.verifySignature(fileName, expires, signature)) {
        next(new AppError(401, 'invalid_signature', 'URL expirada o firma inválida.'));
        return;
    }

    try {
        const result = await audioService.getAudioStream(fileName, req.headers.range);
        res.writeHead(result.statusCode, result.headers);
        // Si el cliente corta la conexión (cambia de canción, cierra la pestaña) se libera el archivo.
        res.on('close', () => result.stream.destroy());
        result.stream.on('error', (error: Error) => {
            logger.error('error leyendo el audio', { fileName, error: error.message });
            res.destroy(error);
        });
        result.stream.pipe(res);
        // Cuenta los bytes de audio entregados (lo muestra el panel de administración).
        result.stream.on('data', (chunk: string | Buffer) => streamMetrics.addBytes(Buffer.byteLength(chunk)));
    } catch (error) {
        next(toHttpError(error));
    }
});

export default router;
