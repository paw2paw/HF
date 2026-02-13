-- Data migration: promote existing ADMIN users to SUPERADMIN
-- (Existing ADMINs are system owners — they should be SUPERADMIN)
UPDATE "User" SET role = 'SUPERADMIN' WHERE role = 'ADMIN';

-- Data migration: rename existing VIEWER users to TESTER
UPDATE "User" SET role = 'TESTER' WHERE role = 'VIEWER';

-- Also update invites that reference old roles
UPDATE "Invite" SET role = 'SUPERADMIN' WHERE role = 'ADMIN';
UPDATE "Invite" SET role = 'TESTER' WHERE role = 'VIEWER';
