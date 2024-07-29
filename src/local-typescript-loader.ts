const getLocalTypescriptPath = () => {
	const cwd = process.cwd();
	try {
		return require.resolve('typescript', {
			paths: [cwd],
		});
	} catch {
		throw new Error(`Could not find \`typescript\` in ${cwd}`);
	}
};

// eslint-disable-next-line import-x/no-dynamic-require
export default require(getLocalTypescriptPath());
