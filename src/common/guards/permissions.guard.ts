import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "src/prisma/prisma.service";
import { PERMISSION_KEY } from "../decorators/permissions.decorator";
import { Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>
            (PERMISSION_KEY, [context.getHandler(), context.getClass()]);

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) {
            throw new ForbiddenException("Không tìm thấy thông tin người dùng");
        }

        const cacheKey = `user:permissions:${user.id}`;
        let userPermission = await this.cacheManager.get<string[]>(cacheKey);

        if (!userPermission) {
            const directRoleIds = user.userRoles?.map((ur: any) => ur.roleId) || [];
            if (directRoleIds.length === 0) {
                throw new ForbiddenException("Tài khoản chưa được gán Role!");
            }

            const allRoleIds = await this.resolveInheritedRoles(directRoleIds);
            userPermission = await this.getPermissionsForRoles(allRoleIds);

            await this.cacheManager.set(cacheKey, userPermission, 3600000);
        }

        // Kiểm tra xem người dùng có đủ quyền API yêu cầu không
        const hasAllPermissions = requiredPermissions.every((permission) =>
            userPermission.includes(permission),
        );

        if (!hasAllPermissions) {
            throw new ForbiddenException("Tài khoản không có quyền thực hiện hành động này!");
        }

        return true;
    }

    // Đệ quy tìm kiếm vai trò cha
    private async resolveInheritedRoles(roleIds: number[]): Promise<number[]> {
        const resolveIds = new Set<number>(roleIds);
        let currentRoleIds = [...roleIds];

        while (currentRoleIds.length > 0) {
            const roles = await this.prisma.role.findMany({
                where: { id: { in: currentRoleIds } },
                select: { id: true, parentId: true },
            });

            const parentIds: number[] = [];
            for (const r of roles) {
                if (r.parentId && !resolveIds.has(r.parentId)) {
                    resolveIds.add(r.parentId);
                    parentIds.push(r.parentId);
                }
            }
            currentRoleIds = parentIds;
        }

        return Array.from(resolveIds);
    }

    // Lấy ra tên các permission từ danh sách roles
    private async getPermissionsForRoles(roleIds: number[]): Promise<string[]> {
        const rolePermissions = await this.prisma.rolePermission.findMany({
            where: { roleId: { in: roleIds } },
            select: {
                permission: {
                    select: { name: true },
                }
            }
        });

        const permNames = rolePermissions.map((rp) => rp.permission.name);
        return Array.from(new Set(permNames));
    }
}






// 1 - lấy ra các permission mà api yêu cầu
// 2 - kiểm tra api có yêu cầu k, nếu k thì cho qua luôn nếu có
// 3 - lấy thông tin user
// 4 - lấy roles của user
// 5 - gom tất cả permission của roles đó cũng như các parrent của roles đó
// 6 - so sánh permission của api yêu cầu và permission user đang có  nếu đủ thì cho qua