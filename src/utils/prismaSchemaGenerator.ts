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

interface EnumDefinition {
  name: string;
  values: string[];
}

const typeMapping: Record<string, string> = {
  string: 'String',
  boolean: 'Boolean',
  number: 'Int',
  bigint: 'BigInt',
};

export const generatePrismaSchema = (generatedDir: string): string => {
  const { models, enums } = parseTypeScriptInterfaces(generatedDir);
  return generateSchema(models, enums);
};

const parseTypeScriptInterfaces = (
  dir: string,
): { models: ModelDefinition[]; enums: EnumDefinition[] } => {
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.ts'));
  const models: ModelDefinition[] = [];
  const enums: EnumDefinition[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const name = path.basename(file, '.ts');

    if (content.includes('export enum')) {
      const enumValues: string[] = [];
      const lines = content.split('\n');
      let isInEnum = false;

      for (const line of lines) {
        if (line.includes('export enum')) {
          isInEnum = true;
          continue;
        }
        if (isInEnum && line.includes('}')) {
          break;
        }
        if (isInEnum) {
          const match = line.match(/^\s*(\w+)[\s,]*$/);
          if (match) {
            enumValues.push(match[1]);
          }
        }
      }

      if (enumValues.length > 0) {
        enums.push({ name, values: enumValues });
      }
    } else if (content.includes('export interface')) {
      const fields: Field[] = [];
      const lines = content.split('\n');

      for (const line of lines) {
        const match = line.match(/^\s*(\w+):\s*(.+);$/);
        if (match) {
          const [, name, type] = match;
          const isArray = type.endsWith('[]');
          const isOptional = type.includes('?') || type.includes('| null');

          // Clean up the type by removing array notation, optional markers, and union with null
          let baseType = type
            .replace('[]', '')
            .replace('?', '')
            .replace(' | null', '')
            .trim();

          fields.push({
            name,
            type: baseType,
            isArray,
            isOptional,
          });
        }
      }

      if (fields.length > 0) {
        models.push({ name, fields });
      }
    }
  }

  return { models, enums };
};

const generateSchema = (
  models: ModelDefinition[],
  enums: EnumDefinition[],
): string => {
  console.dir(enums, { depth: null });
  console.dir(models, { depth: null });
  let schema = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`;

  // First generate enums
  for (const enumDef of enums) {
    schema += `\nenum ${enumDef.name} {\n`;
    for (const value of enumDef.values) {
      schema += `  ${value}\n`;
    }
    schema += '}\n';
  }

  // Then generate models
  for (const model of models) {
    schema += `\nmodel ${model.name} {\n`;
    schema += '  dbId String @id @unique @default(uuid())\n';

    for (const field of model.fields) {
      // Check if this type is an enum by looking for it in our enums array
      const enumDef = enums.find(
        (e) =>
          e.name === field.type || e.name === field.type.replace(/\[\]$/, ''),
      );
      const isEnum = !!enumDef;

      const baseType = isEnum
        ? field.type.replace(/\[\]$/, '')
        : typeMapping[field.type.toLowerCase()] || 'Json';
      const fieldType = `${baseType}${field.isArray ? '[]' : ''}`;

      // For enums, add a default value if it's not optional and not an array
      if (
        isEnum &&
        !field.isOptional &&
        !field.isArray &&
        enumDef.values.length > 0
      ) {
        schema += `  ${field.name} ${fieldType} @default(${enumDef.values[0]})\n`;
      } else {
        schema += `  ${field.name} ${fieldType}${
          field.isOptional ? '?' : ''
        }\n`;
      }
    }

    schema += '}\n';
  }

  return schema;
};
