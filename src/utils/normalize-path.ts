export const normalizePath = (filePath: string) => (
	/^[./]/.test(filePath)
		? filePath
		: `./${filePath}`
);
