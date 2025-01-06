"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveDTOsToFiles = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
exports.saveDTOsToFiles = saveDTOsToFiles;
