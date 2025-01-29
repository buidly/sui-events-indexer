export const toCamelCase = (str: string): string => {
  return str.replace(/(_\w)/g, (m) => m[1].toUpperCase());
};

export const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const lowerCaseFirstLetter = (str: string): string => {
  return str.charAt(0).toLowerCase() + str.slice(1);
};

export const snakeToCamelCase = (str: string): string => {
  // Convert any_case_string to anyCaseString, including uppercase parts
  return str.replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
};
