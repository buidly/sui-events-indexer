import axios from 'axios';
import {
  extractEventTypes,
  extractExternalPackages,
  filterEventStructsAndDependencies,
} from './services/eventExtractor';
import { cleanupDatabase } from './utils/databaseCleanup';
import {
  extractAllStructs,
  generateTypeScriptDTOs,
} from './services/dtoGenerator';
import path from 'path';
import { generatePrismaSchema } from './utils/prismaSchemaGenerator';
import { saveDTOsToFiles } from './utils/fileSystem';
import { execSync } from 'child_process';
import fs from 'fs';
import { SuiClient } from './services/suiClient';

async function main() {
  const rpcUrl = 'https://fullnode.mainnet.sui.io:443';
  const packageId =
    '0x6f5e582ede61fe5395b50c4a449ec11479a54d7ff8e0158247adfda60d98970b';
  const suiClient = new SuiClient(rpcUrl);

  try {
    // Clean up everything first
    cleanupDatabase();

    const packageData = await suiClient.getNormalizedMoveModulesByPackage(
      packageId,
    );

    const bytecode = await suiClient.getPackageBytecode(packageId);

    if (!bytecode) {
      console.error('No bytecode found');
      return;
    }

    // Extract event types from bytecode
    const eventTypes = extractEventTypes(bytecode);

    // Extract all structs from module data
    const allStructs = extractAllStructs(packageData);

    // Filter structs to only include event types and their dependencies
    const eventStructs = await filterEventStructsAndDependencies(
      allStructs,
      eventTypes,
      suiClient,
    );

    // Generate interfaces
    const interfaces = generateTypeScriptDTOs(eventStructs);
    const outputDir = path.join(process.cwd(), 'generated');
    saveDTOsToFiles(interfaces, outputDir);

    // Generate and apply Prisma schema
    const prismaSchema = generatePrismaSchema(outputDir);
    fs.writeFileSync(
      path.join(process.cwd(), 'prisma', 'schema.prisma'),
      prismaSchema,
    );
    console.log('Generated Prisma schema');

    // Apply schema
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
