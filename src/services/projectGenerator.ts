import fs from 'fs';
import path from 'path';
import { EventInfo } from './eventExtractor';

const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

interface ProjectConfig {
  packageId: string;
  projectName: string;
  outputDir: string;
  eventTypes: Set<EventInfo>;
  pollingInterval?: number;
}

export const generateProject = async (config: ProjectConfig) => {
  const { outputDir, projectName, packageId, eventTypes } = config;
  const projectDir = path.join(outputDir, projectName);

  // Create project directory
  fs.mkdirSync(projectDir, { recursive: true });

  // Initialize package.json
  const packageJson = {
    name: projectName,
    version: '1.0.0',
    private: true,
    main: 'server.ts',
    scripts: {
      'db:setup:dev':
        'npx prisma migrate dev --name init --schema=./prisma/schema.prisma',
      'db:reset:dev':
        'npx prisma migrate reset --schema=./prisma/schema.prisma',
      'db:studio': 'npx prisma studio --schema=./prisma/schema.prisma',
      'api:dev': 'npx ts-node server.ts',
      indexer: 'npx ts-node indexer.ts',
      'indexer:fast': 'POLLING_INTERVAL_MS=1000 npx ts-node indexer.ts',
      'indexer:slow': 'POLLING_INTERVAL_MS=10000 npx ts-node indexer.ts',
    },
    dependencies: {
      '@mysten/sui': '^1.18.0',
      '@prisma/client': '^5.16.2',
      cors: '^2.8.5',
      dotenv: '^16.0.3',
      express: '^4.18.2',
    },
    devDependencies: {
      '@types/cors': '^2.8.17',
      '@types/express': '^4.17.21',
      '@types/node': '^20.11.0',
      prisma: '^5.16.2',
      'ts-node': '^10.9.2',
      typescript: '^5.3.3',
    },
  };

  // Create project structure
  const dirs = ['indexer', 'handlers', 'prisma', 'prisma/migrations', 'types'];

  dirs.forEach((dir) => {
    fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
  });

  // Write package.json
  const packageJsonPath = path.join(projectDir, 'package.json');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Create tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'es2020',
      module: 'commonjs',
      outDir: './dist',
      rootDir: '.',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: ['**/*'],
    exclude: ['node_modules'],
  };

  fs.writeFileSync(
    path.join(projectDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2),
  );

  // Create .env
  fs.writeFileSync(
    path.join(projectDir, '.env'),
    `DATABASE_URL="postgresql://prisma:prisma@localhost:5432/${projectName}?schema=public"\n` +
      `PACKAGE_ID="${packageId}"\n` +
      `POLLING_INTERVAL_MS="${config.pollingInterval || 1000}"\n`,
  );

  // Create docker-compose.yml
  const dockerCompose = `
version: '3.8'
services:
  postgres:
    image: postgres:14
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: prisma
      POSTGRES_PASSWORD: prisma
      POSTGRES_DB: ${projectName}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`;

  fs.writeFileSync(
    path.join(projectDir, 'docker-compose.yml'),
    dockerCompose.trim(),
  );

  // Create handler files for each module
  const createHandlerContent = (
    moduleName: string,
    moduleEvents: EventInfo[],
  ) => `
import { SuiEvent } from '@mysten/sui/client';
import { prisma, Prisma } from '../db';

export const handle${capitalizeFirstLetter(
    moduleName,
  )}Events = async (events: SuiEvent[], type: string) => {
  const eventsByType = new Map<string, any[]>();
  
  for (const event of events) {
    if (!event.type.startsWith(type)) throw new Error('Invalid event module origin');
    const eventData = eventsByType.get(event.type) || [];
    eventData.push(event.parsedJson);
    eventsByType.set(event.type, eventData);
  }

  await Promise.all(
    Array.from(eventsByType.entries()).map(async ([eventType, events]) => {
      const eventName = eventType.split('::').pop() || eventType;
      switch (eventName) {
        ${moduleEvents
          .map((e) => {
            const eventName = e.eventType.split('::').pop() || e.eventType;
            return `case '${eventName.split('_').pop()}':
          // TODO: handle ${eventName}
          await prisma.${eventName}.createMany({
            data: events as Prisma.${eventName}CreateManyInput[],
          });
          console.log('Created ${eventName} events');
          break;`;
          })
          .join('\n        ')}
        default:
          console.log('Unknown event type:', eventName);
      }
    }),
  );
};
`;

  // Group events by module
  const eventsByModule = new Map<string, EventInfo[]>();
  for (const event of eventTypes) {
    const events = eventsByModule.get(event.moduleName) || [];
    events.push(event);
    eventsByModule.set(event.moduleName, events);
  }

  // Create handlers for each module
  eventsByModule.forEach((events, moduleName) => {
    fs.writeFileSync(
      path.join(projectDir, 'handlers', `${moduleName}.ts`),
      createHandlerContent(moduleName, events),
    );
  });

  // Create config file
  const configContent = `
import 'dotenv/config';

export const CONFIG = {
  NETWORK: process.env.NETWORK || 'mainnet',
  POLLING_INTERVAL_MS: parseInt(process.env.POLLING_INTERVAL_MS || '5000'),
  CONTRACT: {
    packageId: process.env.PACKAGE_ID || '',
  },
} as const;
`;

  fs.writeFileSync(path.join(projectDir, 'config.ts'), configContent.trim());

  // Create db.ts file
  const dbContent = `
import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export { Prisma };
`;

  fs.writeFileSync(path.join(projectDir, 'db.ts'), dbContent.trim());

  // Create sui-utils.ts file
  const suiUtilsContent = `
import { SuiClient } from '@mysten/sui/client';

const clients: Record<string, SuiClient> = {
  mainnet: new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' }),
  testnet: new SuiClient({ url: 'https://fullnode.testnet.sui.io:443' }),
  devnet: new SuiClient({ url: 'https://fullnode.devnet.sui.io:443' }),
};

export const getClient = (network: string): SuiClient => {
  const client = clients[network.toLowerCase()];
  if (!client) {
    throw new Error(\`Invalid network: \${network}\`);
  }
  return client;
};
`;

  fs.writeFileSync(
    path.join(projectDir, 'sui-utils.ts'),
    suiUtilsContent.trim(),
  );

  // Create indexer.ts file (renamed from index.ts)
  const indexerContent = `
import { setupListeners } from './indexer/event-indexer';

async function main() {
  await setupListeners();
}

main().catch(console.error);
`;

  fs.writeFileSync(path.join(projectDir, 'indexer.ts'), indexerContent.trim());

  // Update event-indexer.ts content
  const eventTrackerContent = `
import { EventId, SuiClient, SuiEvent, SuiEventFilter } from '@mysten/sui/client';
import { CONFIG } from '../config';
import { prisma } from '../db';
import { getClient } from '../sui-utils';
${[...eventsByModule.keys()]
  .map(
    (name) =>
      `import { handle${capitalizeFirstLetter(
        name,
      )}Events } from '../handlers/${name}';`,
  )
  .join('\n')}

type SuiEventsCursor = EventId | null | undefined;

type EventExecutionResult = {
  cursor: SuiEventsCursor;
  hasNextPage: boolean;
};

type EventTracker = {
  type: string;
  filter: SuiEventFilter;
  callback: (events: SuiEvent[], type: string) => any;
};

const EVENTS_TO_TRACK: EventTracker[] = [
  ${[...eventsByModule.entries()]
    .map(
      ([moduleName, _]) => `{
    type: \`\${CONFIG.CONTRACT.packageId}::${moduleName}\`,
    filter: {
      MoveEventModule: {
        module: '${moduleName}',
        package: CONFIG.CONTRACT.packageId,
      },
    },
    callback: handle${capitalizeFirstLetter(moduleName)}Events,
  }`,
    )
    .join(',\n  ')}
];

const executeEventJob = async (
  client: SuiClient,
  tracker: EventTracker,
  cursor: SuiEventsCursor,
): Promise<EventExecutionResult> => {
  try {
    const { data, hasNextPage, nextCursor } = await client.queryEvents({
      query: tracker.filter,
      cursor,
      order: 'ascending',
    });

    await tracker.callback(data, tracker.type);

    if (nextCursor && data.length > 0) {
      await saveLatestCursor(tracker, nextCursor);

      return {
        cursor: nextCursor,
        hasNextPage,
      };
    }
  } catch (e) {
    console.error(e);
  }
  return {
    cursor,
    hasNextPage: false,
  };
};

const runEventJob = async (client: SuiClient, tracker: EventTracker, cursor: SuiEventsCursor) => {
  const result = await executeEventJob(client, tracker, cursor);

  setTimeout(
    () => {
      runEventJob(client, tracker, result.cursor);
    },
    result.hasNextPage ? 0 : CONFIG.POLLING_INTERVAL_MS,
  );
};

const getLatestCursor = async (tracker: EventTracker) => {
  const cursor = await prisma.cursor.findUnique({
    where: {
      id: tracker.type,
    },
  });

  return cursor || undefined;
};

const saveLatestCursor = async (tracker: EventTracker, cursor: EventId) => {
  const data = {
    eventSeq: cursor.eventSeq,
    txDigest: cursor.txDigest,
  };

  return prisma.cursor.upsert({
    where: {
      id: tracker.type,
    },
    update: data,
    create: { id: tracker.type, ...data },
  });
};

export const setupListeners = async () => {
  for (const event of EVENTS_TO_TRACK) {
    runEventJob(getClient(CONFIG.NETWORK), event, await getLatestCursor(event));
  }
};
`;

  // Write event processor file
  fs.writeFileSync(
    path.join(projectDir, 'indexer', 'event-indexer.ts'),
    eventTrackerContent.trim(),
  );

  // Add this function after the other content generators
  const createServerContent = (moduleEvents: Set<EventInfo>) => `
import express from 'express';
import cors from 'cors';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// Event query endpoints
${[...moduleEvents]
  .map((e) => {
    const eventName = e.eventType.split('::').pop() || e.eventType;
    const [module, eventType] = eventName.split('_');
    const endpoint = eventType
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');

    return `app.get('/events/${module}/${endpoint}', async (req, res) => {
  try {
    const events = await prisma.${eventName}.findMany();
    res.json(events);
  } catch (error) {
    console.error('Failed to fetch ${eventName}:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});`;
  })
  .join('\n\n')}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;

  // Add this to the main generateProject function
  fs.writeFileSync(
    path.join(projectDir, 'server.ts'),
    createServerContent(eventTypes),
  );

  return projectDir;
};
