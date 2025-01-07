import { extractAllStructs } from './dtoGenerator';
import { SuiClient } from './suiClient';

export const extractEventTypes = (
  bytecode: Record<string, string>,
): Set<string> => {
  const eventTypes = new Set<string>();

  for (const [moduleName, moduleBytecode] of Object.entries(bytecode)) {
    const lines = moduleBytecode.split('\n');

    // Find all `event::emit` calls
    for (const line of lines) {
      const emitMatch = line.match(/event::emit<([\w_]+)>/);
      if (emitMatch) {
        const eventType = emitMatch[1];
        const packageId = extractPackageId(moduleBytecode);
        eventTypes.add(`${packageId}::${moduleName}_${eventType}`);
      }
    }
  }

  return eventTypes;
};

export const extractExternalPackages = (
  bytecode: Record<string, string>,
): Map<string, string> => {
  const externalPackages = new Map<string, string>();

  for (const [_, moduleBytecode] of Object.entries(bytecode)) {
    const lines = moduleBytecode.split('\n');

    // Collect all `use` statements for external packages
    for (const line of lines) {
      const useMatch = line.match(/use\s+([0-9a-fx]+)::([\w_]+)/);
      if (useMatch) {
        const [_, packageId, moduleName] = useMatch;
        externalPackages.set(moduleName, packageId);
      }
    }
  }

  return externalPackages;
};

export const filterEventStructsAndDependencies = async (
  allStructs: Record<string, any>,
  eventTypes: Set<string>,
  suiClient: SuiClient,
): Promise<Record<string, any>> => {
  const result: Record<string, any> = {};
  const visited = new Set<string>();
  const externalStructsCache: Record<string, any> = {};

  const collectDependencies = async (rawType: string) => {
    if (visited.has(rawType)) return;
    visited.add(rawType);

    const [packageId, type] = rawType.split('::');

    let struct = allStructs[type];

    // If not found in allStructs, try to find in external packages
    if (!struct) {
      // Parse type name to get module and name (assuming format "module_name")
      const bytecode = await suiClient.getPackageBytecode(packageId);
      const externalPackages = extractExternalPackages(bytecode);
      const [module, _] = type.split('_');
      if (externalPackages.has(module)) {
        const packageId = externalPackages.get(module)!;
        // Load external package if not already cached
        if (!externalStructsCache[packageId]) {
          const packageData = await suiClient.getNormalizedMoveModulesByPackage(
            packageId,
          );
          externalStructsCache[packageId] = extractAllStructs(packageData);
        }
        struct = externalStructsCache[packageId][type];
      }
    }

    if (struct) {
      result[type] = struct;

      if (struct.fields) {
        // Process each field's dependencies
        for (const field of struct.fields) {
          const fieldType = field.type;

          if (fieldType.Struct) {
            const { address, module, name } = fieldType.Struct;
            const nestedType = `${address}::${module}_${name}`;
            await collectDependencies(nestedType);
          } else if (fieldType.Vector && fieldType.Vector.Struct) {
            const { address, module, name } = fieldType.Vector.Struct;
            const nestedType = `${address}::${module}_${name}`;
            await collectDependencies(nestedType);
          }
        }
      }
    }
  };

  // Process all event types and their dependencies
  for (const eventType of eventTypes) {
    await collectDependencies(eventType);
  }

  return result;
};

const extractPackageId = (bytecode: string): string => {
  const match = bytecode.match(/module\s+([0-9a-f]+)\.(\w+)/);
  if (!match) return '';
  return match[1];
};
