import fs from 'fs';
import path from 'path';
import { DTOInterface } from '../types/dto-interface';

export const saveDTOsToFiles = (
  dtos: DTOInterface[],
  outputDir: string,
): void => {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  dtos.forEach(({ name, content }) => {
    const fileName = `${name}.ts`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, content);
    console.log(`Generated: ${filePath}`);
  });
};
