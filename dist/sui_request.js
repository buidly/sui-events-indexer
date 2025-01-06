"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function getSuiModules() {
    const url = 'https://fullnode.devnet.sui.io:443';
    const requestBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getNormalizedMoveModulesByPackage',
        params: [
            '0x76edf612a38a5bea903afebd1ebbd498f872bbdddeb4c16623ccbf8e16a902f2',
        ],
    };
    try {
        const response = await axios_1.default.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const structs = extractAllStructs(response.data);
        const interfaces = generateTypeScriptDTOs(structs);
        const outputDir = path_1.default.join(process.cwd(), 'generated');
        saveDTOsToFiles(interfaces, outputDir);
        // console.dir(
        //   interfaces.map((i) => i.content),
        //   { depth: null, colors: true },
        // );
    }
    catch (error) {
        console.error('Error:', error);
    }
}
const extractAllStructs = (response) => {
    const result = {};
    // Iterate through each module in the response
    for (const [moduleName, moduleData] of Object.entries(response.result)) {
        // Use type assertion to inform TypeScript about the expected structure
        const module = moduleData;
        if (module.structs) {
            for (const [structName, structDef] of Object.entries(module.structs)) {
                const uniqueName = `${moduleName}_${structName}`;
                result[uniqueName] = structDef;
            }
        }
    }
    return result;
};
const generateTypeScriptDTOs = (structs) => {
    const interfaces = [];
    for (const [structName, structDef] of Object.entries(structs)) {
        if (structDef.fields) {
            const fields = structDef.fields.map((field) => {
                const tsType = mapNormalizedTypeToTypeScript(field.type);
                return `  ${field.name}: ${tsType};`;
            });
            const interfaceStr = `interface ${structName} {\n${fields.join('\n')}\n}`;
            interfaces.push({
                name: structName,
                content: interfaceStr,
            });
        }
    }
    return interfaces;
};
const saveDTOsToFiles = (dtos, outputDir) => {
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    dtos.forEach(({ name, content }) => {
        const fileName = `${name}.ts`;
        const filePath = path_1.default.join(outputDir, fileName);
        fs_1.default.writeFileSync(filePath, content);
        console.log(`Generated: ${filePath}`);
    });
};
const mapNormalizedTypeToTypeScript = (type) => {
    if (typeof type === 'string') {
        // Handle primitive types
        switch (type) {
            case 'Bool':
                return 'boolean';
            case 'U8':
            case 'U16':
            case 'U32':
                return 'number';
            case 'U64':
            case 'U128':
                return 'bigint';
            case 'U256':
                return 'string'; // Large integers stored as strings
            case 'Address':
                return 'string';
            default:
                return 'Record<string, any>'; // Fallback for unexpected primitives
        }
    }
    if ('Vector' in type) {
        // Handle Vector type
        return `${mapNormalizedTypeToTypeScript(type.Vector)}[]`;
    }
    if ('Struct' in type) {
        // Handle Struct type
        const { module, name, typeArguments } = type.Struct;
        console.log({ module, name, typeArguments });
        // Special case for ID and UID
        if (module === 'object' && (name === 'ID' || name === 'UID')) {
            return 'string';
        }
        // Generic parameters if present
        const genericParams = typeArguments.length
            ? `<${typeArguments.map(mapNormalizedTypeToTypeScript).join(', ')}>`
            : '';
        return `${module}_${name}${genericParams}`;
    }
    // Fallback for unexpected or unhandled structures
    return 'Record<string, any>';
};
// Execute the function
getSuiModules();
