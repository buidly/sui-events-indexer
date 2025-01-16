Sui Events Processor

A CLI tool that generates a complete event indexing solution for Sui Move packages. It automatically:

- Creates TypeScript types from Move events
- Generates a Prisma schema for event persistence
- Scaffolds an event indexer with handlers for each event type
- Sets up a REST API to query indexed events

The generated project provides a production-ready setup for indexing and serving Sui events with type safety and database persistence.

## Features

- 🔄 Automatic TypeScript DTO generation from Move events
- 🗃️ Prisma schema generation
- 🌐 Support for all Sui networks (mainnet, testnet, devnet)
- 🔍 Intelligent dependency resolution for event types
- 📦 Complete project scaffolding with Express API and event indexer
- 🚀 Automatic database schema application
- ⚡ Configurable polling intervals
- 🔄 Event persistence with PostgreSQL

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Docker and Docker Compose (for PostgreSQL)

## Installation

```bash
npm install -g sui-events-indexer
```

### Options

- `-p, --package <id>` (required) - Package ID to index events from
- `--name <name>` (required) - Project name
- `-o, --output <dir>` - Output directory (default: current directory)
- `-n, --network <network>` - Network to use (default: mainnet)
- `-i, --interval <ms>` - Polling interval in milliseconds (default: 1000)

### Example

```bash
sui-events-indexer generate \
-p 0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809 \
--name my-custom-project \
--network mainnet \
-i 1000
```

## Development

To test locally:

```bash
npm run dev:generate -- \
-p 0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809 \
--name my-custom-project \
--network mainnet \
-i 1000
```

## Project Structure

The generated project includes:

```
my-custom-project/
├── prisma/
│   └── schema.prisma     # Generated Prisma schema
├── handlers/             # Event-specific handlers
├── indexer/             # Event indexing logic
├── types/               # Generated TypeScript types
├── config.ts            # Project configuration
├── db.ts                # Database client
├── indexer.ts           # Indexer entry point
├── server.ts            # Express API server
└── docker-compose.yml   # PostgreSQL setup
```

## Running the Project

1. Start the database:

```bash
docker compose up -d
```

2. Setup the database schema:

```bash
npm run db:setup:dev
```

3. Start the indexer:

```bash
npm run indexer:dev
```

4. Start the API server:

```bash
npm run server:dev
```

## API Endpoints

The project automatically generates RESTful endpoints for each event type in your package. Each endpoint follows the pattern `/events/{module}/{event-name}` where the event name is converted to kebab-case format.

Access your indexed events through these dynamically generated endpoints that match your package's event structure.
