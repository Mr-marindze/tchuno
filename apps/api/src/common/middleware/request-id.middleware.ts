import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & {
  requestId?: string;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const headerValue = req.headers['x-request-id'];

    const requestId =
      typeof headerValue === 'string'
        ? headerValue.slice(0, 128)
        : Array.isArray(headerValue) && typeof headerValue[0] === 'string'
          ? headerValue[0].slice(0, 128)
          : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}
