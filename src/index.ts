#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import {
  extractAllStructs,
  generateTypeScriptDTOs,
} from './services/dtoGenerator';
import {
  extractEventTypes,
  filterEventStructsAndDependencies,
} from './services/eventExtractor';
import { generateProject } from './services/projectGenerator';
import { SuiClient } from './services/suiClient';
import { saveDTOsToFiles } from './utils/fileSystem';
import { generatePrismaSchema } from './utils/prismaSchemaGenerator';

const NETWORK_RPC_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
} as const;

type Network = keyof typeof NETWORK_RPC_URLS;

const program = new Command();

async function generateTypes(
  packageId: string,
  network: Network,
  projectDir: string,
) {
  const rpcUrl = NETWORK_RPC_URLS[network];
  const suiClient = new SuiClient(rpcUrl);

  try {
    const packageData = await suiClient.getNormalizedMoveModulesByPackage(
      packageId,
    );

    const bytecode = await suiClient.getPackageBytecode(packageId);

    if (!bytecode) {
      console.error('No bytecode found');
      return;
    }

    // Extract event types from bytecode
    const eventTypes = extractEventTypes(bytecode, packageData);

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
    const outputDir = path.join(projectDir, 'types');
    saveDTOsToFiles(interfaces, outputDir);

    // Generate Prisma schema
    const prismaSchema = generatePrismaSchema(outputDir);
    fs.writeFileSync(
      path.join(projectDir, 'prisma', 'schema.prisma'),
      prismaSchema,
    );
    console.log('Generated Prisma schema');

    // Don't run Prisma commands here
  } catch (error) {
    console.error('Error:', error);
  }
}

program
  .name('sui-events-indexer')
  .description(
    'Generate TypeScript types and Prisma schema from Sui Move package events',
  )
  .version('1.0.0');

program
  .command('generate')
  .description('Generate a new event indexer project')
  .requiredOption('-p, --package <id>', 'Package ID to index events from')
  .requiredOption('--name <name>', 'Project name')
  .option('-o, --output <dir>', 'Output directory', '.')
  .option('-n, --network <network>', 'Network to use', 'mainnet')
  .option('-i, --interval <ms>', 'Polling interval in milliseconds', '1000')
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
      // First get the event types
      const rpcUrl = NETWORK_RPC_URLS[network as Network];
      const suiClient = new SuiClient(rpcUrl);
      const packageData = await suiClient.getNormalizedMoveModulesByPackage(
        options.package,
      );
      const bytecode = await suiClient.getPackageBytecode(options.package);
      const eventTypes = extractEventTypes(bytecode, packageData);

      // Then generate the project
      const projectDir = await generateProject({
        packageId: options.package,
        projectName: options.name,
        outputDir: options.output,
        eventTypes,
        pollingInterval: parseInt(options.interval),
      });

      // Finally generate types and schema
      await generateTypes(options.package, network as Network, projectDir);

      console.log(`
Project generated successfully at ${projectDir}

To get started:
  cd ${projectDir}
  npm install
  docker-compose up -d
  npm run db:setup:dev
  npm run indexer
`);
    } catch (error) {
      console.error('Failed to generate project:', error);
      process.exit(1);
    }
  });

program.parse();
