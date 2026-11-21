// How Prisma connects, for the API and the seed scripts alike. The database
// is whichever DATABASE_URL names: PostgreSQL (postgresql://…) or MySQL /
// MariaDB (mysql://…). The client must be generated from the matching
// schema (`npm run db:generate` picks it from the same URL).
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma } from '../generated/prisma/client.js';
import { dialectOf } from './sql.js';

export function prismaClientOptions(url: string) {
  if (dialectOf(url) === 'mysql') {
    return {
      adapter: new PrismaMariaDb(url),
      // MySQL defaults to REPEATABLE READ. The services lock a row and then
      // read it, and expect to see its latest saved state, as PostgreSQL's
      // default READ COMMITTED gives them.
      transactionOptions: { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    };
  }
  return { adapter: new PrismaPg({ connectionString: url }) };
}
