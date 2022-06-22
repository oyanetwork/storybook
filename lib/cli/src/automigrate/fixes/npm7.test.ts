import { NPMProxy } from '../../js-package-manager/NPMProxy';
import { npm7 } from './npm7';

const mockExecuteCommand = jest.fn();
class MockedNPMProxy extends NPMProxy {
  executeCommand(...args) {
    return mockExecuteCommand(...args);
  }
}

function mockExecuteResults(map: Record<string, string>) {
  mockExecuteCommand.mockImplementation((command, args) => {
    const commandString = `${command} ${args.join(' ')}`;
    if (map[commandString]) return map[commandString];

    throw new Error(`Unexpected execution of '${commandString}'`);
  });
}

describe('npm7 fix', () => {
  describe('npm < 7', () => {
    it('does not match', async () => {
      mockExecuteResults({ 'npm --version': '6.0.0' });
      expect(await npm7.check({ packageManager: new MockedNPMProxy() })).toEqual(null);
    });
  });

  describe('npm 7+', () => {
    it('matches if config is not installed', async () => {
      mockExecuteResults({
        'npm --version': '7.0.0',
        'npm config get legacy-peer-deps --location=project': 'false',
      });
      expect(await npm7.check({ packageManager: new MockedNPMProxy() })).toEqual({
        npmVersion: '7.0.0',
      });
    });

    it('does not match if config is installed', async () => {
      mockExecuteResults({
        'npm --version': '7.0.0',
        'npm config get legacy-peer-deps --location=project': 'true',
      });
      expect(await npm7.check({ packageManager: new MockedNPMProxy() })).toEqual(null);
    });
  });
});
