import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  status: string;
  message: string;
  result: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ headers?: { accept?: string } }>();
    const acceptHeader = request?.headers?.accept;

    if (typeof acceptHeader === 'string' && acceptHeader.includes('text/event-stream')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) return data;
        return {
          status: 'Ok',
          message: data?.message ?? 'Request successful',
          result: data?.result ?? null,
        };
      }),
    );
  }
}