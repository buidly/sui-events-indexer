import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  extractAllStructs,
  generateTypeScriptDTOs,
} from './services/dtoGenerator';
import { saveDTOsToFiles } from './utils/fileSystem';
import { generatePrismaSchema } from './utils/prismaSchemaGenerator';
import { cleanupDatabase } from './utils/databaseCleanup';

async function main() {
  const url = 'https://fullnode.devnet.sui.io:443';

  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'sui_getNormalizedMoveModulesByPackage',
    params: [
      '0x816b07586fc507ee9c96e1faeba5713c0f96e0e4441b9a046db0f75a344e0984',
    ],
  };

  try {
    // Clean up everything first
    cleanupDatabase();

    // Fetch and generate TypeScript DTOs
    const response = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const structs = extractAllStructs(response.data);
    const interfaces = generateTypeScriptDTOs(structs);
    const outputDir = path.join(process.cwd(), 'generated');
    saveDTOsToFiles(interfaces, outputDir);

    // Generate and apply Prisma schema
    const prismaSchema = generatePrismaSchema(outputDir);
    fs.writeFileSync(
      path.join(process.cwd(), 'prisma', 'schema.prisma'),
      prismaSchema,
    );
    console.log('Generated Prisma schema');

    // Apply schema directly without migrations
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
      execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
      console.log('Applied database schema');
    } catch (error) {
      console.error('Error applying schema:', error);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
