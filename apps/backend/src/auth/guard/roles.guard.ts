import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "src/prisma.service";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorator/roles.decorator";


@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector, private prisma: PrismaService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles) return true;

        const { user } = context.switchToHttp().getRequest();

        if (!user) return false;

        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.id},
            select: { role: true }
        });

        if (!dbUser || !requiredRoles.includes(dbUser.role)) {
            throw new ForbiddenException('Permission denied');
        }

        return true;
    }
}