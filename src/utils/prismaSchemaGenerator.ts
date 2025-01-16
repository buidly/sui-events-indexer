import fs from 'fs';
import path from 'path';

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

const generateSchemaHeader = (): string => `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
`;

const parseEnumValues = (lines: string[]): string[] => {
  const enumValues: string[] = [];
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

  return enumValues;
};

const parseField = (line: string): Field | null => {
  const match = line.match(/^\s*(\w+):\s*(.+);$/);
  if (!match) return null;

  const [, name, type] = match;
  const isArray = type.endsWith('[]');
  const isOptional = type.includes('?') || type.includes('| null');

  // Clean up the type
  const baseType = type
    .replace('[]', '')
    .replace('?', '')
    .replace('| null', '')
    .replace(' | null', '')
    .trim();

  return {
    name,
    type: baseType,
    isArray,
    isOptional,
  };
};

const generateEnumDefinitions = (enums: EnumDefinition[]): string => {
  let schema = '';
  for (const enumDef of enums) {
    schema += `\nenum ${enumDef.name} {\n`;
    for (const value of enumDef.values) {
      schema += `  ${value}\n`;
    }
    schema += '}\n';
  }
  return schema;
};

const generateModelField = (field: Field, enums: EnumDefinition[]): string => {
  const enumDef = enums.find(
    (e) => e.name === field.type || e.name === field.type.replace(/\[\]$/, ''),
  );
  const isEnum = !!enumDef;

  const baseType = isEnum
    ? field.type.replace(/\[\]$/, '')
    : typeMapping[field.type.toLowerCase()] || 'Json';
  const fieldType = `${baseType}${field.isArray ? '[]' : ''}`;

  if (
    isEnum &&
    !field.isOptional &&
    !field.isArray &&
    enumDef.values.length > 0
  ) {
    return `  ${field.name} ${fieldType} @default(${enumDef.values[0]})\n`;
  }

  return `  ${field.name} ${fieldType}${field.isOptional ? '?' : ''}\n`;
};

const generateModelDefinitions = (
  models: ModelDefinition[],
  enums: EnumDefinition[],
): string => {
  let schema = '';
  for (const model of models) {
    schema += `\nmodel ${model.name} {\n`;
    schema += '  dbId String @id @unique @default(uuid())\n';

    for (const field of model.fields) {
      schema += generateModelField(field, enums);
    }

    schema += '}\n';
  }
  return schema;
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
      const enumValues = parseEnumValues(content.split('\n'));
      if (enumValues.length > 0) {
        enums.push({ name, values: enumValues });
      }
    } else if (content.includes('export interface')) {
      const fields: Field[] = [];
      const lines = content.split('\n');

      for (const line of lines) {
        const field = parseField(line);
        if (field) {
          fields.push(field);
        }
      }

      if (fields.length > 0) {
        models.push({ name, fields });
      }
    }
  }

  return { models, enums };
};

export const generatePrismaSchema = (generatedDir: string): string => {
  const { models, enums } = parseTypeScriptInterfaces(generatedDir);

  // Add the Cursor model for event tracking
  const cursorModel = `
model cursor {
  id        String @id
  eventSeq  String
  txDigest  String
}`;

  return [
    generateSchemaHeader(),
    generateEnumDefinitions(enums),
    generateModelDefinitions(models, enums),
    cursorModel,
  ].join('\n');
};
