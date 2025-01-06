"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTypeScriptDTOs = exports.extractAllStructs = void 0;
const typeMapper_1 = require("../utils/typeMapper");
const extractAllStructs = (response) => {
    const result = {};
    for (const [moduleName, moduleData] of Object.entries(response.result)) {
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
exports.extractAllStructs = extractAllStructs;
const generateTypeScriptDTOs = (structs) => {
    const interfaces = [];
    for (const [structName, structDef] of Object.entries(structs)) {
        if (structDef.fields) {
            const fields = structDef.fields.map((field) => {
                const tsType = (0, typeMapper_1.mapNormalizedTypeToTypeScript)(field.type);
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
exports.generateTypeScriptDTOs = generateTypeScriptDTOs;
