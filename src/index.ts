#!/usr/bin/env node

import { Command } from 'commander';
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

const NETWORK_RPC_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
} as const;

type Network = keyof typeof NETWORK_RPC_URLS;

const program = new Command();

async function generateTypes(packageId: string, network: Network) {
  const rpcUrl = NETWORK_RPC_URLS[network];
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

program
  .name('sui-events-processor')
  .description(
    'Generate TypeScript types and Prisma schema from Sui Move package events',
  )
  .version('1.0.0');

program
  .command('generate')
  .description('Generate types from a Sui package')
  .requiredOption('-p, --package <id>', 'Sui package ID')
  .option('-n, --network <network>', 'Sui network to use', 'mainnet')
  .action(async (options) => {
    const network = options.network.toLowerCase();
    if (!Object.keys(NETWORK_RPC_URLS).includes(network)) {
      console.error(
        `Invalid network. Must be one of: ${Object.keys(NETWORK_RPC_URLS).join(
          ', ',
        )}`,
      );
      process.exit(1);
    }

    try {
      await generateTypes(options.package, network as Network);
      console.log('Successfully generated types and schema!');
    } catch (error) {
      console.error('Failed to generate types:', error);
      process.exit(1);
    }
  });

program.parse();
