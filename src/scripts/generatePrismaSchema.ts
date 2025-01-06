import { generatePrismaSchema } from '../utils/prismaSchemaGenerator';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function main() {
  const generatedDir = path.join(process.cwd(), 'generated');
  const prismaSchema = generatePrismaSchema(generatedDir);

  // Write the schema to prisma/schema.prisma
  fs.writeFileSync(
    path.join(process.cwd(), 'prisma', 'schema.prisma'),
    prismaSchema,
  );

  console.log('Generated Prisma schema');

  // Run prisma migrate
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
    console.log('Applied database migrations');
  } catch (error) {
    console.error('Error applying migrations:', error);
  }
}

main().catch(console.error);
