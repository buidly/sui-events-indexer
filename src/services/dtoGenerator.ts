import { DTOInterface } from '../types/sui';
import { mapNormalizedTypeToTypeScript } from '../utils/typeMapper';

export const extractAllStructs = (response: any): Record<string, any> => {
  const result: Record<string, any> = {};

  for (const [moduleName, moduleData] of Object.entries(response.result)) {
    const module = moduleData as { structs?: Record<string, any> };

    if (module.structs) {
      for (const [structName, structDef] of Object.entries(module.structs)) {
        const uniqueName = `${moduleName}_${structName}`;
        result[uniqueName] = structDef;
      }
    }
  }

  return result;
};

export const generateTypeScriptDTOs = (
  structs: Record<string, any>,
): DTOInterface[] => {
  const interfaces: DTOInterface[] = [];

  for (const [structName, structDef] of Object.entries(structs)) {
    if (structDef.fields) {
      const fields = structDef.fields.map((field: any) => {
        const tsType = mapNormalizedTypeToTypeScript(field.type);
        return `  ${field.name}: ${tsType};`;
      });

      interfaces.push({
        name: structName,
        content: `interface ${structName} {\n${fields.join('\n')}\n}`,
      });
    }
  }

  return interfaces;
};
