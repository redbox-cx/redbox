import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile
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
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }
        return {
          status: 'Ok',
          message: data?.message || 'Request successful',
          result: data?.result !== undefined ? data.result : (data?.message ? { ...data, message: undefined } : data),
        };
      }),
    );
  }
}