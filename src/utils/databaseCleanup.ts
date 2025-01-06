import fs from 'fs';
import { execSync } from 'child_process';

export const cleanupDatabase = () => {
  try {
    console.log('Cleaning up database and generated files...');

    // Stop and remove Docker containers and volumes
    execSync('docker-compose down -v', { stdio: 'inherit' });

    // Remove generated directories and files
    const pathsToClean = [
      'prisma/migrations',
      'prisma/schema.prisma',
      'generated',
    ];

    for (const path of pathsToClean) {
      if (fs.existsSync(path)) {
        if (fs.lstatSync(path).isDirectory()) {
          fs.rmSync(path, { recursive: true });
        } else {
          fs.unlinkSync(path);
        }
      }
    }

    // Start fresh containers
    execSync('docker-compose up -d', { stdio: 'inherit' });

    // Wait a bit for PostgreSQL to be ready
    console.log('Waiting for PostgreSQL to start...');
    execSync('sleep 3');

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
};
