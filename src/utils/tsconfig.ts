import { getTsconfig } from 'get-tsconfig';

export const tsconfig = getTsconfig() ?? { path: process.cwd(), config: {}};
