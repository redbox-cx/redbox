import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import {
  AdminInviteCodesQueryDto,
  CreateAdminInviteCodeDto,
  CreateRandomAdminInviteCodeDto,
  UpdateAdminInviteCodeValidityDto,
} from '../dto/invites.dto';

@Injectable()
export class AdminInvitesService {
  constructor(private readonly prismaService: PrismaService) {}

  async getInviteCodes(adminUserId: string, query: AdminInviteCodesQueryDto) {
    const where: Prisma.InviteCodeWhereInput = {
      isAdminCreated: true,
      createdByAdminUserId: adminUserId,
    };

    if (query.search) {
      where.code = { contains: query.search.trim() };
    }

    if (query.isValid !== undefined) {
      where.isValid = query.isValid;
    }

    const [items, total] = await Promise.all([
      this.prismaService.inviteCode.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              username: true,
            },
          },
          createdByAdminUser: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prismaService.inviteCode.count({ where }),
    ]);

    return {
      items: items.map((invite) => ({
        id: invite.id,
        code: invite.code,
        usage: invite.usage,
        isValid: invite.isValid,
        createdAt: invite.createdAt.toISOString(),
        createdByUser: invite.creator
          ? {
              id: invite.creator.id,
              username: invite.creator.username,
            }
          : null,
        createdByAdmin: invite.createdByAdminUser
          ? {
              id: invite.createdByAdminUser.id,
              username: invite.createdByAdminUser.username,
            }
          : null,
      })),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        returned: items.length,
        hasMore: query.offset + items.length < total,
        total,
      },
    };
  }

  async createInviteCode(adminUserId: string, dto: CreateAdminInviteCodeDto) {
    const code = this.normalizeOrCreateCode(dto.code);

    try {
      const inviteCode = await this.prismaService.$transaction(async (prisma) => {
        const createdInviteCode = await prisma.inviteCode.create({
          data: {
            code,
            usage: dto.usage,
            isValid: dto.isValid ?? true,
            createdByAdminUserId: adminUserId,
            isAdminCreated: true,
          },
        });

        await prisma.adminAuditLog.create({
          data: {
            actorType: AuditActorType.ADMIN,
            adminUserId,
            action: 'admin_invite_code_created',
            reason: `Invite code "${code}" created with ${dto.usage} uses`,
            meta: {
              inviteCodeId: createdInviteCode.id,
              code,
              usage: dto.usage,
              isValid: dto.isValid ?? true,
            },
          },
        });

        return createdInviteCode;
      });

      return {
        success: true,
        message: 'Invite code created successfully',
        inviteCode: {
          id: inviteCode.id,
          code: inviteCode.code,
          usage: inviteCode.usage,
          isValid: inviteCode.isValid,
          createdAt: inviteCode.createdAt.toISOString(),
        },
      };
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        throw new ConflictException('Invite code already exists');
      }

      throw error;
    }
  }

  createRandomInviteCode(adminUserId: string, dto: CreateRandomAdminInviteCodeDto) {
    return this.createInviteCode(adminUserId, {
      usage: dto.usage,
      isValid: dto.isValid,
    });
  }

  async deleteInviteCode(adminUserId: string, inviteCodeId: string) {
    const inviteCode = await this.prismaService.inviteCode.findFirst({
      where: {
        id: inviteCodeId,
        isAdminCreated: true,
        createdByAdminUserId: adminUserId,
      },
    });

    if (!inviteCode) {
      throw new NotFoundException('Admin invite code not found');
    }

    await this.prismaService.$transaction(async (prisma) => {
      await prisma.inviteCode.delete({
        where: { id: inviteCode.id },
      });

      await prisma.adminAuditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          adminUserId,
          action: 'admin_invite_code_deleted',
          reason: `Invite code "${inviteCode.code}" deleted/revoked`,
          meta: {
            inviteCodeId: inviteCode.id,
            code: inviteCode.code,
            usage: inviteCode.usage,
            isValid: inviteCode.isValid,
          },
        },
      });
    });

    return {
      success: true,
      message: 'Invite code deleted successfully',
      inviteCodeId: inviteCode.id,
      code: inviteCode.code,
    };
  }

  async updateInviteCodeValidity(
    adminUserId: string,
    inviteCodeId: string,
    dto: UpdateAdminInviteCodeValidityDto,
  ) {
    const inviteCode = await this.prismaService.inviteCode.findFirst({
      where: {
        id: inviteCodeId,
        isAdminCreated: true,
        createdByAdminUserId: adminUserId,
      },
    });

    if (!inviteCode) {
      throw new NotFoundException('Admin invite code not found');
    }

    const updatedInviteCode = await this.prismaService.$transaction(async (prisma) => {
      const updated = await prisma.inviteCode.update({
        where: { id: inviteCode.id },
        data: { isValid: dto.isValid },
      });

      await prisma.adminAuditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          adminUserId,
          action: dto.isValid
            ? 'admin_invite_code_enabled'
            : 'admin_invite_code_disabled',
          reason: `Invite code "${inviteCode.code}" ${dto.isValid ? 'enabled' : 'disabled'}`,
          meta: {
            inviteCodeId: inviteCode.id,
            code: inviteCode.code,
            previousIsValid: inviteCode.isValid,
            newIsValid: dto.isValid,
            usage: inviteCode.usage,
          },
        },
      });

      return updated;
    });

    return {
      success: true,
      message: `Invite code ${updatedInviteCode.isValid ? 'enabled' : 'disabled'} successfully`,
      inviteCode: {
        id: updatedInviteCode.id,
        code: updatedInviteCode.code,
        usage: updatedInviteCode.usage,
        isValid: updatedInviteCode.isValid,
        createdAt: updatedInviteCode.createdAt.toISOString(),
      },
    };
  }

  private normalizeOrCreateCode(code?: string) {
    const normalizedCode = code?.trim();
    if (!normalizedCode) {
      return `RB-${randomBytes(8).toString('hex').toUpperCase()}`;
    }

    if (normalizedCode.length > 50) {
      throw new BadRequestException("Invite code can't be longer than 50 characters");
    }

    return normalizedCode;
  }

  private isUniqueConflict(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
