import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = 'permissions';

// Nhận vào danh sách các code quyền được yêu cầu
export const RequirePermissions = (...permission: string[]) =>
    SetMetadata(PERMISSION_KEY, permission);