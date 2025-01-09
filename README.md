# Sui Events Processor

A CLI tool that automatically generates TypeScript types and Prisma schema from Sui Move package events. This tool helps bridge the gap between Sui Move events and TypeScript applications by providing type-safe interfaces and database schemas.

## Features

- 🔄 Automatic TypeScript DTO generation from Move events
- 🗃️ Prisma schema generation
- 🌐 Support for all Sui networks (mainnet, testnet, devnet)
- 🔍 Intelligent dependency resolution for event types
- 🚀 Automatic database schema application

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Prisma CLI
- A running database (PostgreSQL recommended)

## How to Use (when it will be available on npm)

npx sui-events-processor generate \
--package <package-id> \
--network <mainnet|testnet|devnet>

## Example

npx sui-events-processor generate \
--package 0x8f611e924bcca2d5e18789da43683a89348fcea91ebd8624a24f416b5a532235 \
--network devnet

## How to test locally

npm run dev:generate -- -p 0xbd8d4489782042c6fafad4de4bc6a5e0b84a43c6c00647ffd7062d1e2bb7549e --network mainnet
