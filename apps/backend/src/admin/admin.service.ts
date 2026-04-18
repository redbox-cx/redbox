import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ADMIN_AUDIT_LOGS,
  ADMIN_BACKEND_LOGS,
  ADMIN_BLOG_POSTS,
  ADMIN_BUG_REPORTS,
  ADMIN_CONTENT_REPORTS,
  ADMIN_DASHBOARD_CHARTS,
  ADMIN_DASHBOARD_STATS,
  ADMIN_FRONTEND_LOGS,
  ADMIN_MAIL_SENDERS,
  ADMIN_MAIL_TEMPLATES,
  ADMIN_MAILS,
  ADMIN_REPORTS_HISTORY,
  ADMIN_ROUTES,
  ADMIN_STORAGE_BREAKDOWN,
  ADMIN_STORAGE_COUNT,
  ADMIN_TRAFFIC_HISTORY,
  ADMIN_TRAFFIC_SUMMARY,
  ADMIN_USERS_STATS,
  type AdminAuditLogRecord,
  type AdminBlogPostRecord,
  type AdminBugReport,
  type AdminContentReport,
  type AdminLogRecord,
  type AdminMailRecord,
  type AdminRouteRecord,
} from './admin.data';
import { AdminContentReportsQueryDto, ResolveAdminReportDto } from './dto/reports.dto';
import { OffsetPaginationQueryDto } from './dto/common.dto';
import {
  AdminUsersQueryDto,
  UpdateAdminUserStatusDto,
  ChangeAdminUsernameDto,
  DeleteAdminUserFilesDto,
  ForceLogoutAdminUserDto,
} from './dto/users.dto';
import { AuditLogsQueryDto } from './dto/audit.dto';
import { PauseAdminRouteDto } from './dto/routes.dto';
import { AdminMailsQueryDto, RecallAdminMailDto, SendAdminMailDto } from './dto/mails.dto';
import { AdminBlogQueryDto, CreateAdminBlogPostDto, UpdateAdminBlogPostDto } from './dto/blog.dto';
import { AdminLogsQueryDto } from './dto/logs.dto';
import { UsersService } from 'src/users/users.service';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminService {
  constructor(private readonly usersService: UsersService) {}

  private readonly startedAt = Date.now();
  private readonly adminProfile = {
    id: 'adm_1',
    username: 'Admin',
  };

  private contentReports: AdminContentReport[] = clone(ADMIN_CONTENT_REPORTS);
  private bugReports: AdminBugReport[] = clone(ADMIN_BUG_REPORTS);
  private auditLogs: AdminAuditLogRecord[] = clone(ADMIN_AUDIT_LOGS);
  private routes: AdminRouteRecord[] = clone(ADMIN_ROUTES);
  private mails: AdminMailRecord[] = clone(ADMIN_MAILS);
  private blogPosts: AdminBlogPostRecord[] = clone(ADMIN_BLOG_POSTS);
  private backendLogs: AdminLogRecord[] = clone(ADMIN_BACKEND_LOGS);
  private frontendLogs: AdminLogRecord[] = clone(ADMIN_FRONTEND_LOGS);

  getPing() {
    return {
      ok: true,
      message: 'pong',
      serverTime: Date.now(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      status: 'online',
    };
  }

  getDashboard() {
    return {
      stats: {
        ...clone(ADMIN_DASHBOARD_STATS),
        openReports: {
          value: this.contentReports.length + this.bugReports.length,
        },
      },
      storage: {
        percentUsed: ADMIN_STORAGE_COUNT.percentUsed,
        usedAmount: ADMIN_STORAGE_COUNT.usedAmount,
        totalAmount: ADMIN_STORAGE_COUNT.totalAmount,
        breakdown: clone(ADMIN_STORAGE_BREAKDOWN),
      },
      charts: clone(ADMIN_DASHBOARD_CHARTS),
    };
  }

  getUserCount() {
    return this.usersService.getAdminUserCountSummary();
  }

  getStorageCount() {
    return clone(ADMIN_STORAGE_COUNT);
  }

  getTraffic() {
    return {
      ...clone(ADMIN_TRAFFIC_SUMMARY),
      history: clone(ADMIN_TRAFFIC_HISTORY),
    };
  }

  getReportsSummary() {
    return {
      openReports: this.contentReports.length + this.bugReports.length,
      contentReportsOpen: this.contentReports.length,
      bugReportsOpen: this.bugReports.length,
      archivedReports: 0,
      history: clone(ADMIN_REPORTS_HISTORY),
    };
  }

  getContentReports(query: AdminContentReportsQueryDto) {
    const source = query.status === 'archived' ? [] : this.contentReports;
    return this.paginateArray(source, query);
  }

  getBugReports(query: OffsetPaginationQueryDto) {
    return this.paginateArray(this.bugReports, query);
  }

  getArchivedReports(query: OffsetPaginationQueryDto) {
    return this.paginateArray([], query);
  }

  resolveReport(reportId: string, dto: ResolveAdminReportDto) {
    const contentReport = this.contentReports.find((report) => report.id === reportId);
    if (contentReport) {
      this.contentReports = this.contentReports.filter((report) => report.id !== reportId);
      this.recordAuditLog('resolve_report', 'report', reportId, contentReport.reportedUser.username, dto.actionTaken);
      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    const bugReport = this.bugReports.find((report) => report.id === reportId);
    if (bugReport) {
      this.bugReports = this.bugReports.filter((report) => report.id !== reportId);
      this.recordAuditLog('resolve_report', 'report', reportId, bugReport.subject, dto.actionTaken);
      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    throw new NotFoundException('Report not found');
  }

  getUsersStats() {
    return this.usersService.getAdminUsersStats();
  }

  getUsers(query: AdminUsersQueryDto) {
    return this.usersService.getAdminUsers(query);
  }

  getUserById(userId: string) {
    return this.usersService.getAdminUserById(userId);
  }

  async updateUserStatus(adminUserId: string, userId: string, dto: UpdateAdminUserStatusDto) {
    return this.usersService.updateUserStatusByAdmin(adminUserId, userId, dto);
  }

  async forceLogoutUser(adminUserId: string, userId: string, dto: ForceLogoutAdminUserDto) {
    return this.usersService.forceLogoutUserByAdmin(adminUserId, userId, dto);
  }

  async changeUsername(adminUserId: string, userId: string, dto: ChangeAdminUsernameDto) {
    return this.usersService.changeUsernameByAdmin(adminUserId, userId, dto);
  }

  async deleteUserFiles(adminUserId: string, userId: string, dto: DeleteAdminUserFilesDto) {
    return this.usersService.deleteUserFilesByAdmin(adminUserId, userId, dto);
  }

  getAuditLogs(query: AuditLogsQueryDto) {
    return this.usersService.getAdminAuditLogs(query);
  }

  getRoutes() {
    return clone(this.routes);
  }

  pauseRoute(routeId: string, dto: PauseAdminRouteDto) {
    const route = this.findRouteOrThrow(routeId);
    route.paused = true;
    route.pausedBy = this.adminProfile.username;
    route.pausedAt = this.formatDisplayTimestamp();
    route.reason = dto.reason;
    this.recordAuditLog('pause_route', 'route', route.route, route.route, dto.reason);

    return {
      success: true,
      message: 'Route paused successfully',
    };
  }

  unpauseRoute(routeId: string) {
    const route = this.findRouteOrThrow(routeId);
    route.paused = false;
    route.pausedBy = null;
    route.pausedAt = null;
    route.reason = null;
    this.recordAuditLog('unpause_route', 'route', route.route, route.route, 'Route unpaused');

    return {
      success: true,
      message: 'Route unpaused successfully',
    };
  }

  getMailSenders() {
    return clone(ADMIN_MAIL_SENDERS);
  }

  getMailTemplates() {
    return clone(ADMIN_MAIL_TEMPLATES);
  }

  getMails(query: AdminMailsQueryDto) {
    let items = [...this.mails];

    if (query.senderId) {
      items = items.filter((mail) => mail.sender.id === query.senderId);
    }

    if (query.search) {
      const searchValue = query.search.toLowerCase();
      items = items.filter(
        (mail) =>
          mail.subject.toLowerCase().includes(searchValue) ||
          mail.body.toLowerCase().includes(searchValue) ||
          mail.recipients.some((recipient) => recipient.toLowerCase().includes(searchValue)),
      );
    }

    if (query.isBroadcast !== undefined) {
      items = items.filter((mail) => mail.isBroadcast === query.isBroadcast);
    }

    const paginatedItems = items.slice(query.offset, query.offset + query.limit);

    return {
      items: clone(paginatedItems),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: paginatedItems.length,
        hasMore: query.offset + paginatedItems.length < items.length,
      },
    };
  }

  sendMail(dto: SendAdminMailDto) {
    const sender = ADMIN_MAIL_SENDERS.find((entry) => entry.id === dto.senderId);
    if (!sender) {
      throw new NotFoundException('Sender not found');
    }

    if (!dto.isBroadcast && dto.recipients.length === 0) {
      throw new BadRequestException('At least one recipient is required when isBroadcast is false');
    }

    const mailId = `mail_${Date.now()}`;
    this.mails.unshift({
      id: mailId,
      sender,
      recipients: dto.recipients,
      isBroadcast: dto.isBroadcast,
      subject: dto.subject,
      body: dto.body,
      isHtml: dto.isHtml,
      template: dto.template ?? null,
      attachments: dto.attachments,
      sentAt: new Date().toISOString(),
      canRecall: true,
      recalledAt: null,
    });

    this.recordAuditLog('send_mail', 'mail', mailId, dto.subject, 'Mail sent', {
      isBroadcast: dto.isBroadcast,
      recipients: dto.recipients.length,
    });

    return {
      success: true,
      message: 'Mail sent successfully',
      mailId,
    };
  }

  recallMail(mailId: string, dto: RecallAdminMailDto) {
    const mail = this.findMailOrThrow(mailId);
    mail.canRecall = false;
    mail.recalledAt = new Date().toISOString();
    this.recordAuditLog('recall_mail', 'mail', mail.id, mail.subject, dto.reason);

    return {
      success: true,
      message: 'Mail recalled successfully',
    };
  }

  deleteMail(mailId: string) {
    const mail = this.findMailOrThrow(mailId);
    this.mails = this.mails.filter((entry) => entry.id !== mailId);
    this.recordAuditLog('delete_mail', 'mail', mail.id, mail.subject, 'Mail deleted');

    return {
      success: true,
      message: 'Mail deleted/recalled successfully',
    };
  }

  getBlogPosts(query: AdminBlogQueryDto) {
    let items = [...this.blogPosts];

    if (query.status) {
      items = items.filter((post) => post.status === query.status);
    }

    if (query.search) {
      const searchValue = query.search.toLowerCase();
      items = items.filter(
        (post) =>
          post.title.toLowerCase().includes(searchValue) ||
          post.slug.toLowerCase().includes(searchValue) ||
          post.excerpt.toLowerCase().includes(searchValue),
      );
    }

    const paginatedItems = items.slice(query.offset, query.offset + query.limit);

    return {
      items: clone(paginatedItems),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: paginatedItems.length,
        hasMore: query.offset + paginatedItems.length < items.length,
      },
    };
  }

  createBlogPost(dto: CreateAdminBlogPostDto) {
    if (this.blogPosts.some((post) => post.slug === dto.slug)) {
      throw new BadRequestException('Slug already exists');
    }

    const now = new Date().toISOString();
    const postId = `post_${Date.now()}`;
    this.blogPosts.unshift({
      id: postId,
      title: dto.title,
      slug: dto.slug,
      excerpt: dto.excerpt,
      content: dto.content,
      isHtml: dto.isHtml,
      status: dto.status,
      author: this.adminProfile.username,
      createdAt: now,
      updatedAt: now,
      publishedAt: dto.status === 'published' ? now : null,
    });

    this.recordAuditLog('create_blog_post', 'blog', postId, dto.title, 'Blog post created');

    return {
      success: true,
      message: 'Blog post created successfully',
      postId,
    };
  }

  updateBlogPost(postId: string, dto: UpdateAdminBlogPostDto) {
    const post = this.findBlogPostOrThrow(postId);

    if (dto.slug && dto.slug !== post.slug && this.blogPosts.some((entry) => entry.slug === dto.slug)) {
      throw new BadRequestException('Slug already exists');
    }

    post.title = dto.title ?? post.title;
    post.slug = dto.slug ?? post.slug;
    post.excerpt = dto.excerpt ?? post.excerpt;
    post.content = dto.content ?? post.content;
    post.isHtml = dto.isHtml ?? post.isHtml;
    post.status = dto.status ?? post.status;
    post.updatedAt = new Date().toISOString();

    if (post.status === 'published' && !post.publishedAt) {
      post.publishedAt = post.updatedAt;
    }

    this.recordAuditLog('update_blog_post', 'blog', post.id, post.title, 'Blog post updated');

    return {
      success: true,
      message: 'Blog post updated successfully',
    };
  }

  deleteBlogPost(postId: string) {
    const post = this.findBlogPostOrThrow(postId);
    this.blogPosts = this.blogPosts.filter((entry) => entry.id !== postId);
    this.recordAuditLog('delete_blog_post', 'blog', post.id, post.title, 'Blog post deleted');

    return {
      success: true,
      message: 'Blog post deleted successfully',
    };
  }

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

  private paginateArray<T>(items: T[], query: OffsetPaginationQueryDto) {
    return clone(items.slice(query.offset, query.offset + query.limit));
  }

  private findRouteOrThrow(routeId: string) {
    const decodedRouteId = this.decodeRouteId(routeId);
    const route = this.routes.find((entry) => entry.route === decodedRouteId);
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route;
  }

  private decodeRouteId(routeId: string) {
    try {
      return decodeURIComponent(routeId);
    } catch {
      return routeId;
    }
  }

  private findMailOrThrow(mailId: string) {
    const mail = this.mails.find((entry) => entry.id === mailId);
    if (!mail) {
      throw new NotFoundException('Mail not found');
    }

    return mail;
  }

  private findBlogPostOrThrow(postId: string) {
    const post = this.blogPosts.find((entry) => entry.id === postId);
    if (!post) {
      throw new NotFoundException('Blog post not found');
    }

    return post;
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

  private recordAuditLog(
    action: string,
    targetType: string,
    targetId: string,
    targetLabel: string,
    reason: string,
    meta: Record<string, unknown> = {},
  ) {
    this.auditLogs.unshift({
      id: `AUD-${String(this.auditLogs.length + 1).padStart(4, '0')}`,
      timestamp: this.formatDisplayTimestamp(),
      timestampIso: new Date().toISOString(),
      adminId: this.adminProfile.id,
      adminUsername: this.adminProfile.username,
      action,
      targetType,
      targetId,
      targetLabel,
      ipAddress: '91.23.11.4',
      reason,
      meta,
    });
  }

  private formatDisplayTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private extractFilename(link: string) {
    return link.split('/').pop() ?? link;
  }
}
