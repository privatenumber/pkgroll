function getLocalTypescriptPath() {
	const cwd = process.cwd();
	try {
		return require.resolve('typescript', {
			paths: [cwd],
		});
	} catch {
		throw new Error(`Could not find \`typescript\` in ${cwd}`);
	}
}

// eslint-disable-next-line node/global-require
export default require(getLocalTypescriptPath());
