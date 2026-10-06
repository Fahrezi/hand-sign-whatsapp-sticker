import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // read directly (not env()) so `prisma generate` works without a DB configured
  datasource: { url: process.env.DATABASE_URL },
});
