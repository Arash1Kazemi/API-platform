import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const ADMIN_ONLY = 'adminOnly';
/** No login needed. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Only the logged-in admin (browser session), not API keys. */
export const AdminOnly = () => SetMetadata(ADMIN_ONLY, true);
