import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL picks the database: postgresql://… uses prisma/schema.prisma
// and prisma/migrations; mysql://… (MySQL or MariaDB) uses the generated
// prisma/mysql/schema.prisma and prisma/mysql/migrations.
const url = process.env['DATABASE_URL'];
const mysql = /^(mysql|mariadb):/i.test(url?.trim() ?? '');

export default defineConfig({
  schema: mysql ? 'prisma/mysql/schema.prisma' : 'prisma/schema.prisma',
  migrations: {
    path: mysql ? 'prisma/mysql/migrations' : 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma's MySQL engine reads mysql:// only; the app's driver takes either.
    url: mysql ? url!.trim().replace(/^mariadb:/i, 'mysql:') : url,
  },
});
