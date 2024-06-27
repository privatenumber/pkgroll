import { testSuite, expect } from 'manten';
import { createFixture } from 'fs-fixture';
import { pkgroll } from '../../utils.js';
import {
	installTypeScript,
	createPackageJson,
	createTsconfigJson,
} from '../../fixtures.js';

export default testSuite(({ describe }, nodePath: string) => {
	describe('symlink', ({ test }) => {
		test('pnpm monorepo', async () => {
			await using fixture = await createFixture({
				...installTypeScript,
				packages: {
					one: {
						'package.json': createPackageJson({
							type: 'module',
							main: './dist/index.cjs',
							module: './dist/index.mjs',
							types: './dist/index.d.cts',
							dependencies: {
								vue: '*',
							},
							peerDependencies: {
								vue: '*',
							},
						}),
						'tsconfig.json': createTsconfigJson({
							extends: '../../tsconfig.base.json',
							compilerOptions: {
								preserveSymlinks: false,
							},
							include: ['src'],
							exclude: ['**/dist', '**/node_modules'],
						}),
						node_modules: {
							vue: {
								'index.d.ts': ({ symlink }) => symlink('../../../../node_modules/.pnpm/vue/index.d.ts'),
								node_modules: {
									'@vue': {
										'runtime-dom': ({ symlink }) => symlink('../../../../node_modules/.pnpm/@vue/runtime-dom'),
									},
								},
							},
						},
						'src/index.ts': `
						import { defineComponent, h } from 'vue';
						export default defineComponent({
              props: {
                message: String,
              },
              setup(props) {
                h('div', {
                  ...props,
                });
              },
            });
						`,
					},
				},
				'tsconfig.base.json': createTsconfigJson({
					compilerOptions: {
						module: 'ESNext',
						target: 'ES2020',
						lib: ['DOM', 'DOM.Iterable', 'ES2020'],
						moduleResolution: 'Bundler',
						strict: true,
					},
				}),
				'package.json': createPackageJson({
					type: 'module',
				}),
				'node_modules/': {
					'.pnpm': {
						'@vue/runtime-dom/index.d.ts': `
              type ComponentProps = {
                props: {
                  message: StringConstructor;
                };
                setup: (props: ComponentProps['props']) => any;
              };
              export declare function h(el: string, props: ComponentProps['props']): any;
              export declare function defineComponent({
                props,
                setup,
              }: ComponentProps): ComponentProps;
              `,
						vue: {
							node_modules: {
								'@vue': {
									'runtime-dom': ({ symlink }) => symlink('../../../@vue/runtime-dom'),
								},
							},
							'index.d.ts': 'export * from \'@vue/runtime-dom\';',
						},
					},
				},
			});

			const pkgrollOne = await pkgroll([], {
				cwd: `${fixture.path}/packages/one`,
				localDir: fixture.path,
				nodePath,
			});
			expect(pkgrollOne.exitCode).toBe(0);
			expect(pkgrollOne.stderr).toBe('');

			const contentOne = await fixture.readFile('packages/one/dist/index.mjs', 'utf8');
			expect(contentOne).toEqual(`import { defineComponent, h } from 'vue';

var index = defineComponent({
  props: {
    message: String
  },
  setup(props) {
    h("div", {
      ...props
    });
  }
});

export { index as default };
`);
		});
	});
});
