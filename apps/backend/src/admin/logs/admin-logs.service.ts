import { Injectable } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { ADMIN_BACKEND_LOGS, ADMIN_FRONTEND_LOGS, type AdminLogRecord } from '../admin.data';
import { AdminLogsQueryDto } from '../dto/logs.dto';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminLogsService {
  private backendLogs: AdminLogRecord[] = clone(ADMIN_BACKEND_LOGS);
  private frontendLogs: AdminLogRecord[] = clone(ADMIN_FRONTEND_LOGS);

  getBackendLogs(query: AdminLogsQueryDto) {
    return this.filterLogEntries(this.backendLogs, query);
  }

  getFrontendLogs(query: AdminLogsQueryDto) {
    return this.filterLogEntries(this.frontendLogs, query);
  }

  getBackendLogStream(): Observable<MessageEvent> {
    return this.createLogStream(this.backendLogs);
  }

  getFrontendLogStream(): Observable<MessageEvent> {
    return this.createLogStream(this.frontendLogs);
  }

  private filterLogEntries(items: AdminLogRecord[], query: AdminLogsQueryDto) {
    let filteredItems = [...items];

    if (query.level) {
      filteredItems = filteredItems.filter((item) => item.level === query.level);
    }

    if (query.search) {
      const searchValue = query.search.toLowerCase();
      filteredItems = filteredItems.filter((item) => {
        const metaValue = JSON.stringify(item.meta).toLowerCase();
        return item.message.toLowerCase().includes(searchValue) || metaValue.includes(searchValue);
      });
    }

    const paginatedItems = filteredItems.slice(query.offset, query.offset + query.limit);

    return {
      items: clone(paginatedItems),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: paginatedItems.length,
        hasMore: query.offset + paginatedItems.length < filteredItems.length,
      },
    };
  }

  private createLogStream(items: AdminLogRecord[]): Observable<MessageEvent> {
    return interval(3000).pipe(
      map((index) => ({
        type: 'log',
        data: clone(items[index % items.length]),
      })),
    );
  }
}
