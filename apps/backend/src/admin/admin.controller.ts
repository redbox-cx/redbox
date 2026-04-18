import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminJwtAuthGuard } from './guard/admin-auth.guard';
import { AdminService } from './admin.service';
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

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('ping')
  getPing() {
    return {
      message: 'Admin ping fetched successfully',
      result: this.adminService.getPing(),
    };
  }

  @Get('dashboard')
  getDashboard() {
    return {
      message: 'Dashboard fetched successfully',
      result: this.adminService.getDashboard(),
    };
  }

  @Get('usercount')
  getUserCount() {
    return {
      message: 'User count fetched successfully',
      result: this.adminService.getUserCount(),
    };
  }

  @Get('storagecount')
  getStorageCount() {
    return {
      message: 'Storage count fetched successfully',
      result: this.adminService.getStorageCount(),
    };
  }

  @Get('traffic')
  getTraffic() {
    return {
      message: 'Traffic fetched successfully',
      result: this.adminService.getTraffic(),
    };
  }

  @Get('reports/summary')
  getReportsSummary() {
    return {
      message: 'Report summary fetched successfully',
      result: this.adminService.getReportsSummary(),
    };
  }

  @Get('reports/content')
  getContentReports(@Query() query: AdminContentReportsQueryDto) {
    return {
      message: 'Content reports fetched successfully',
      result: this.adminService.getContentReports(query),
    };
  }

  @Get('reports/bugs')
  getBugReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Bug reports fetched successfully',
      result: this.adminService.getBugReports(query),
    };
  }

  @Get('reports/archived')
  getArchivedReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Archived reports fetched successfully',
      result: this.adminService.getArchivedReports(query),
    };
  }

  @Post('reports/:reportId/resolve')
  resolveReport(@Param('reportId') reportId: string, @Body() dto: ResolveAdminReportDto) {
    const result = this.adminService.resolveReport(reportId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Get('users/stats')
  getUsersStats() {
    return {
      message: 'User stats fetched successfully',
      result: this.adminService.getUsersStats(),
    };
  }

  @Get('users')
  getUsers(@Query() query: AdminUsersQueryDto) {
    return {
      message: 'Users fetched successfully',
      result: this.adminService.getUsers(query),
    };
  }

  @Get('users/:userId')
  getUserById(@Param('userId') userId: string) {
    return {
      message: 'User fetched successfully',
      result: this.adminService.getUserById(userId),
    };
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserStatusDto,
  ) {
    const result = await this.adminService.updateUserStatus(adminUserId, userId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('users/:userId/force-logout')
  async forceLogoutUser(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: ForceLogoutAdminUserDto,
  ) {
    const result = await this.adminService.forceLogoutUser(adminUserId, userId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Patch('users/:userId/username')
  async changeUsername(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeAdminUsernameDto,
  ) {
    const result = await this.adminService.changeUsername(adminUserId, userId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('users/:userId/files')
  async deleteUserFiles(
    @GetUserId() adminUserId: string,
    @Param('userId') userId: string,
    @Body() dto: DeleteAdminUserFilesDto,
  ) {
    return {
      message: 'User files deleted successfully',
      result: await this.adminService.deleteUserFiles(adminUserId, userId, dto),
    };
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: AuditLogsQueryDto) {
    return {
      message: 'Audit logs fetched successfully',
      result: this.adminService.getAuditLogs(query),
    };
  }

  @Get('routes')
  getRoutes() {
    return {
      message: 'Routes fetched successfully',
      result: this.adminService.getRoutes(),
    };
  }

  @Post('routes/:routeId/pause')
  pauseRoute(@Param('routeId') routeId: string, @Body() dto: PauseAdminRouteDto) {
    const result = this.adminService.pauseRoute(routeId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('routes/:routeId/unpause')
  unpauseRoute(@Param('routeId') routeId: string) {
    const result = this.adminService.unpauseRoute(routeId);
    return {
      message: result.message,
      result,
    };
  }

  @Get('mails/senders')
  getMailSenders() {
    return {
      message: 'Mail senders fetched successfully',
      result: this.adminService.getMailSenders(),
    };
  }

  @Get('mails/templates')
  getMailTemplates() {
    return {
      message: 'Mail templates fetched successfully',
      result: this.adminService.getMailTemplates(),
    };
  }

  @Get('mails')
  getMails(@Query() query: AdminMailsQueryDto) {
    return {
      message: 'Mails fetched successfully',
      result: this.adminService.getMails(query),
    };
  }

  @Post('mails')
  sendMail(@Body() dto: SendAdminMailDto) {
    const result = this.adminService.sendMail(dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('mails/:mailId/recall')
  recallMail(@Param('mailId') mailId: string, @Body() dto: RecallAdminMailDto) {
    const result = this.adminService.recallMail(mailId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('mails/:mailId')
  deleteMail(@Param('mailId') mailId: string) {
    const result = this.adminService.deleteMail(mailId);
    return {
      message: result.message,
      result,
    };
  }

  @Get('blog')
  getBlogPosts(@Query() query: AdminBlogQueryDto) {
    return {
      message: 'Blog posts fetched successfully',
      result: this.adminService.getBlogPosts(query),
    };
  }

  @Post('blog')
  createBlogPost(@Body() dto: CreateAdminBlogPostDto) {
    const result = this.adminService.createBlogPost(dto);
    return {
      message: result.message,
      result,
    };
  }

  @Patch('blog/:postId')
  updateBlogPost(@Param('postId') postId: string, @Body() dto: UpdateAdminBlogPostDto) {
    const result = this.adminService.updateBlogPost(postId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Delete('blog/:postId')
  deleteBlogPost(@Param('postId') postId: string) {
    const result = this.adminService.deleteBlogPost(postId);
    return {
      message: result.message,
      result,
    };
  }

  @Get('logs/backend')
  getBackendLogs(@Query() query: AdminLogsQueryDto) {
    return {
      message: 'Backend logs fetched successfully',
      result: this.adminService.getBackendLogs(query),
    };
  }

  @Sse('logs/backend/stream')
  getBackendLogStream(): Observable<MessageEvent> {
    return this.adminService.getBackendLogStream();
  }

  @Get('logs/frontend')
  getFrontendLogs(@Query() query: AdminLogsQueryDto) {
    return {
      message: 'Frontend logs fetched successfully',
      result: this.adminService.getFrontendLogs(query),
    };
  }

  @Sse('logs/frontend/stream')
  getFrontendLogStream(): Observable<MessageEvent> {
    return this.adminService.getFrontendLogStream();
  }
}
