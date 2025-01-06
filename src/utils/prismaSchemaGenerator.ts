import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface Field {
  name: string;
  type: string;
  isArray: boolean;
  isOptional: boolean;
}

interface ModelDefinition {
  name: string;
  fields: Field[];
}

const typeMapping: Record<string, string> = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Int',
  bigint: 'BigInt',
};

export const generatePrismaSchema = (generatedDir: string): string => {
  const models = parseTypeScriptInterfaces(generatedDir);
  const relations = findRelations(models);
  return generateSchema(models, relations);
};

const parseTypeScriptInterfaces = (dir: string): ModelDefinition[] => {
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.ts'));
  const models: ModelDefinition[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const modelName = path.basename(file, '.ts');

    const fields: Field[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^\s*(\w+):\s*(.+);$/);
      if (match) {
        const [, name, type] = match;
        const isArray = type.endsWith('[]');
        const baseType = type.replace('[]', '').trim();
        const isOptional = type.includes('?');

        fields.push({
          name,
          type: baseType,
          isArray,
          isOptional,
        });
      }
    }

    models.push({ name: modelName, fields });
  }

  return models;
};

const findRelations = (models: ModelDefinition[]): Map<string, Set<string>> => {
  const relations = new Map<string, Set<string>>();
  const modelNames = new Set(models.map((m) => m.name));

  for (const model of models) {
    for (const field of model.fields) {
      if (modelNames.has(field.type)) {
        if (!relations.has(model.name)) {
          relations.set(model.name, new Set());
        }
        relations.get(model.name)!.add(field.type);
      }
    }
  }

  return relations;
};

const generateSchema = (
  models: ModelDefinition[],
  relations: Map<string, Set<string>>,
): string => {
  let schema = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`;

  for (const model of models) {
    schema += `\nmodel ${model.name} {\n`;

    // Add dbId as primary key
    schema += '  dbId String @id @unique @default(uuid())\n';

    for (const field of model.fields) {
      const prismaType = typeMapping[field.type.toLowerCase()] || 'Json';

      // Handle all fields as regular fields (no relations)
      const fieldType = `${prismaType}${field.isArray ? '[]' : ''}`;
      schema += `  ${field.name} ${fieldType}${field.isOptional ? '?' : ''}\n`;
    }

    schema += '}\n';
  }

  return schema;
};
