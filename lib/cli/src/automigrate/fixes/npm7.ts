import chalk from 'chalk';
import dedent from 'ts-dedent';
import { Fix } from '../types';
import { NPMProxy } from '../../js-package-manager/NPMProxy';

interface Npm7RunOptions {
  npmVersion: string;
}

/**
 * Is the user using npm7+? If so create a .npmrc with legacy-peer-deps=true
 */
export const npm7: Fix<Npm7RunOptions> = {
  id: 'npm7',

  async check({ packageManager }) {
    if (packageManager.type !== 'npm') return null;

    const npmVersion = (packageManager as NPMProxy).getNpmVersion();
    if ((packageManager as NPMProxy).needsLegacyPeerDeps(npmVersion)) {
      return { npmVersion };
    }
    return null;
  },

  prompt({ npmVersion }) {
    const npmFormatted = chalk.cyan(`npm ${npmVersion}`);
    return dedent`
      We've detected you are running ${npmFormatted} which has peer dependency semantics which Storybook is incompatible with.

      In order to work with Storybook's package structure, you'll need to run \`npm\` with the
      \`--legacy-peer-deps=true\` flag. We can generate an \`.npmrc\` which will do that automatically.
      
      More info: ${chalk.yellow('https://github.com/storybookjs/storybook/issues/18298')}
    `;
  },

  async run({ packageManager }) {
    (packageManager as NPMProxy).setLegacyPeerDeps();
  },
};
