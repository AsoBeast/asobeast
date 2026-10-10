import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { withinStoreDeadline } from './store-deadline';

@Injectable()
export class StoreDeadlineInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return withinStoreDeadline(() => next.handle());
  }
}
