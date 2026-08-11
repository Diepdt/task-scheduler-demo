import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding permissions and roles...');

    // 1. Tạo các Permission động
    const permissions = [
        { name: 'USER_READ', description: 'Xem danh sách người dùng' },
        { name: 'USER_CREATE', description: 'Tạo người dùng mới' },
        { name: 'USER_DELETE', description: 'Xóa người dùng' },
        { name: 'TASK_READ', description: 'Xem danh sách task' },
        { name: 'TASK_RUN', description: 'Chạy tác vụ scheduler' },
    ];

    const dbPermissions: any[] = [];
    for (const perm of permissions) {
        const p = await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
        dbPermissions.push(p);
    }

    // 2. Tạo các vai trò và thiết lập Kế Thừa (parentId)
    const roleUser = await prisma.role.upsert({
        where: { name: 'USER' },
        update: {},
        create: { name: 'USER', description: 'Người dùng cơ bản' },
    });

    const roleStaff = await prisma.role.upsert({
        where: { name: 'STAFF' },
        update: {},
        create: { name: 'STAFF', description: 'Nhân viên vận hành', parentId: roleUser.id },
    });

    const roleAdmin = await prisma.role.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: { name: 'ADMIN', description: 'Quản trị viên tối cao', parentId: roleStaff.id },
    });

    // 3. Gán quyền cho các Vai trò
    const findPermId = (name: string) => dbPermissions.find(p => p.name === name)!.id;

    // USER có quyền: USER_READ, TASK_READ
    await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleUser.id, permissionId: findPermId('USER_READ') } },
        update: {},
        create: { roleId: roleUser.id, permissionId: findPermId('USER_READ') },
    });
    await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleUser.id, permissionId: findPermId('TASK_READ') } },
        update: {},
        create: { roleId: roleUser.id, permissionId: findPermId('TASK_READ') },
    });

    // STAFF có thêm quyền: TASK_RUN
    await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleStaff.id, permissionId: findPermId('TASK_RUN') } },
        update: {},
        create: { roleId: roleStaff.id, permissionId: findPermId('TASK_RUN') },
    });

    // ADMIN có thêm quyền: USER_CREATE, USER_DELETE
    await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleAdmin.id, permissionId: findPermId('USER_CREATE') } },
        update: {},
        create: { roleId: roleAdmin.id, permissionId: findPermId('USER_CREATE') },
    });
    await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleAdmin.id, permissionId: findPermId('USER_DELETE') } },
        update: {},
        create: { roleId: roleAdmin.id, permissionId: findPermId('USER_DELETE') },
    });

    console.log('Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
