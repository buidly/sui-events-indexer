"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const dtoGenerator_1 = require("./services/dtoGenerator");
const fileSystem_1 = require("./utils/fileSystem");
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
        const structs = (0, dtoGenerator_1.extractAllStructs)(response.data);
        const interfaces = (0, dtoGenerator_1.generateTypeScriptDTOs)(structs);
        const outputDir = path_1.default.join(process.cwd(), 'generated');
        (0, fileSystem_1.saveDTOsToFiles)(interfaces, outputDir);
    }
    catch (error) {
        console.error('Error:', error);
    }
}
getSuiModules();
