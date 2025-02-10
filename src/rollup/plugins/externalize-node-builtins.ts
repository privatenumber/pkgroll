import { builtinModules } from 'node:module';
import type { Plugin } from 'rollup';

type Semver = [number, number, number];

const compareSemver = (
	semverA: Semver,
	semverB: Semver,
) => (
	semverA[0] - semverB[0]
	|| semverA[1] - semverB[1]
	|| semverA[2] - semverB[2]
);

/**
 * Implemented as a plugin instead of the external API
 * to support altering the import specifier to remove `node:`
 *
 * Alternatively, we can create a mapping via output.paths
 * but this seems cleaner
 */
export const externalizeNodeBuiltins = ({ target }: {
	target: string[];
}): Plugin => {
	/**
	 * Only remove protocol if a Node.js version that doesn't
	 * support it is specified.
	 */
	const stripNodeProtocol = target.some((platform) => {
		platform = platform.trim();

		// Ignore non Node platforms
		if (!platform.startsWith('node')) {
			return;
		}

		const parsedVersion = platform.slice(4).split('.').map(Number);
		const semver: Semver = [
			parsedVersion[0],
			parsedVersion[1] ?? 0,
			parsedVersion[2] ?? 0,
		];

		return !(

			// 12.20.0 <= x < 13.0.0
			(
				compareSemver(semver, [12, 20, 0]) >= 0
				&& compareSemver(semver, [13, 0, 0]) < 0
			)

			// 14.13.1 <= x
			|| compareSemver(semver, [14, 13, 1]) >= 0
		);
	});

	return {
		name: 'externalize-node-builtins',
		resolveId: (id) => {
			const hasNodeProtocol = id.startsWith('node:');
			if (stripNodeProtocol && hasNodeProtocol) {
				id = id.slice(5);
			}

			if (builtinModules.includes(id) || hasNodeProtocol) {
				return {
					id,
					external: true,
				};
			}
		},
	};
};
