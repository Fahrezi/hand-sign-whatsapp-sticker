import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { User } from './generated/prisma/client.js';

type Req = IncomingMessage & { user?: User; originalUrl?: string };

// One JSON line per request (pretty-printed in dev). Headers and bodies are
// not logged, so cookies, tokens and Google credentials never reach the logs.
export function loggerParams(config: ConfigService): Params {
  const isProd = config.get('NODE_ENV') === 'production';
  return {
    pinoHttp: {
      level: config.get<string>('LOG_LEVEL') || (isProd ? 'info' : 'debug'),
      transport: isProd ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      // evaluated when the response is logged, so req.user from SessionGuard is set
      customProps: (req: IncomingMessage) => {
        const userId = (req as Req).user?.id;
        return userId ? { userId } : {};
      },
      customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    },
  };
}
