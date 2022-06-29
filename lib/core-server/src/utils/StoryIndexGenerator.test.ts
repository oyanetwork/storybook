import path from 'path';
import fs from 'fs-extra';
import { normalizeStoriesEntry } from '@storybook/core-common';
import type { NormalizedStoriesSpecifier } from '@storybook/core-common';
import { loadCsf, getStorySortParameter } from '@storybook/csf-tools';
import { toId } from '@storybook/csf';
import { logger } from '@storybook/node-logger';
import { mocked } from 'ts-jest/utils';

import { StoryIndexGenerator } from './StoryIndexGenerator';

jest.mock('@storybook/csf-tools');
jest.mock('@storybook/csf', () => {
  const csf = jest.requireActual('@storybook/csf');
  return {
    ...csf,
    toId: jest.fn(csf.toId),
  };
});

// FIXME: can't figure out how to import ESM
jest.mock('@storybook/docs-mdx', async () => ({
  analyze(content: string) {
    const importMatches = content.matchAll(/'(.[^']*\.stories)'/g);
    const imports = Array.from(importMatches).map((match) => match[1]);
    const title = content.match(/title=['"](.*)['"]/)?.[1];
    const name = content.match(/name=['"](.*)['"]/)?.[1];
    const ofMatch = content.match(/of=\{(.*)\}/)?.[1];
    const isTemplate = content.match(/isTemplate/);
    return { title, name, imports, of: ofMatch && imports.length && imports[0], isTemplate };
  },
}));

jest.mock('@storybook/node-logger');

const toIdMock = toId as jest.Mock<ReturnType<typeof toId>>;
const loadCsfMock = loadCsf as jest.Mock<ReturnType<typeof loadCsf>>;
const getStorySortParameterMock = getStorySortParameter as jest.Mock<
  ReturnType<typeof getStorySortParameter>
>;

const csfIndexer = async (fileName: string, opts: any) => {
  const code = (await fs.readFile(fileName, 'utf-8')).toString();
  return loadCsf(code, { ...opts, fileName }).parse();
};

const options = {
  configDir: path.join(__dirname, '__mockdata__'),
  workingDir: path.join(__dirname, '__mockdata__'),
  storyIndexers: [{ test: /\.stories\..*$/, indexer: csfIndexer }],
  storiesV2Compatibility: false,
  storyStoreV7: true,
  docs: { enabled: true, defaultName: 'docs', docsPage: false },
};

describe('StoryIndexGenerator', () => {
  beforeEach(() => {
    const actual = jest.requireActual('@storybook/csf-tools');
    loadCsfMock.mockImplementation(actual.loadCsf);
    mocked(logger.warn).mockClear();
  });
  describe('extraction', () => {
    const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
      './src/A.stories.(ts|js|jsx)',
      options
    );
    const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
      './src/docs2/*.mdx',
      options
    );

    describe('single file specifier', () => {
      it('extracts stories from the right files', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.js',
          options
        );

        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
    });
    describe('non-recursive specifier', () => {
      it('extracts stories from the right files', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/*/*.stories.(ts|js|jsx)',
          options
        );

        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "nested-button--story-one": Object {
                "id": "nested-button--story-one",
                "importPath": "./src/nested/Button.stories.ts",
                "name": "Story One",
                "title": "nested/Button",
                "type": "story",
              },
              "second-nested-g--story-one": Object {
                "id": "second-nested-g--story-one",
                "importPath": "./src/second-nested/G.stories.ts",
                "name": "Story One",
                "title": "second-nested/G",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
    });

    describe('recursive specifier', () => {
      it('extracts stories from the right files', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
              "b--story-one": Object {
                "id": "b--story-one",
                "importPath": "./src/B.stories.ts",
                "name": "Story One",
                "title": "B",
                "type": "story",
              },
              "d--story-one": Object {
                "id": "d--story-one",
                "importPath": "./src/D.stories.jsx",
                "name": "Story One",
                "title": "D",
                "type": "story",
              },
              "first-nested-deeply-f--story-one": Object {
                "id": "first-nested-deeply-f--story-one",
                "importPath": "./src/first-nested/deeply/F.stories.js",
                "name": "Story One",
                "title": "first-nested/deeply/F",
                "type": "story",
              },
              "nested-button--story-one": Object {
                "id": "nested-button--story-one",
                "importPath": "./src/nested/Button.stories.ts",
                "name": "Story One",
                "title": "nested/Button",
                "type": "story",
              },
              "second-nested-g--story-one": Object {
                "id": "second-nested-g--story-one",
                "importPath": "./src/second-nested/G.stories.ts",
                "name": "Story One",
                "title": "second-nested/G",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
    });

    describe('addDocsTemplate indexer', () => {
      const templateIndexer = { ...options.storyIndexers[0], addDocsTemplate: true };

      it('adds docs entry with docs enabled', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.js',
          options
        );

        const generator = new StoryIndexGenerator([specifier], {
          ...options,
          storyIndexers: [templateIndexer],
        });
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--docs": Object {
                "id": "a--docs",
                "importPath": "./src/A.stories.js",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "A",
                "type": "docs",
              },
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
      it('does not add docs entry with docs disabled', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.js',
          options
        );

        const generator = new StoryIndexGenerator([specifier], {
          ...options,
          storyIndexers: [templateIndexer],
          docs: { enabled: false },
        });
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
    });

    describe('docsPage', () => {
      const docsPageOptions = {
        ...options,
        docs: { ...options.docs, docsPage: true },
      };
      it('generates an entry per CSF file', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        const generator = new StoryIndexGenerator([specifier], docsPageOptions);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--docs": Object {
                "id": "a--docs",
                "importPath": "./src/A.stories.js",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "A",
                "type": "docs",
              },
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
              "b--docs": Object {
                "id": "b--docs",
                "importPath": "./src/B.stories.ts",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "B",
                "type": "docs",
              },
              "b--story-one": Object {
                "id": "b--story-one",
                "importPath": "./src/B.stories.ts",
                "name": "Story One",
                "title": "B",
                "type": "story",
              },
              "d--docs": Object {
                "id": "d--docs",
                "importPath": "./src/D.stories.jsx",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "D",
                "type": "docs",
              },
              "d--story-one": Object {
                "id": "d--story-one",
                "importPath": "./src/D.stories.jsx",
                "name": "Story One",
                "title": "D",
                "type": "story",
              },
              "first-nested-deeply-f--docs": Object {
                "id": "first-nested-deeply-f--docs",
                "importPath": "./src/first-nested/deeply/F.stories.js",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "first-nested/deeply/F",
                "type": "docs",
              },
              "first-nested-deeply-f--story-one": Object {
                "id": "first-nested-deeply-f--story-one",
                "importPath": "./src/first-nested/deeply/F.stories.js",
                "name": "Story One",
                "title": "first-nested/deeply/F",
                "type": "story",
              },
              "nested-button--docs": Object {
                "id": "nested-button--docs",
                "importPath": "./src/nested/Button.stories.ts",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "nested/Button",
                "type": "docs",
              },
              "nested-button--story-one": Object {
                "id": "nested-button--story-one",
                "importPath": "./src/nested/Button.stories.ts",
                "name": "Story One",
                "title": "nested/Button",
                "type": "story",
              },
              "second-nested-g--docs": Object {
                "id": "second-nested-g--docs",
                "importPath": "./src/second-nested/G.stories.ts",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [],
                "title": "second-nested/G",
                "type": "docs",
              },
              "second-nested-g--story-one": Object {
                "id": "second-nested-g--story-one",
                "importPath": "./src/second-nested/G.stories.ts",
                "name": "Story One",
                "title": "second-nested/G",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });

      it('does not generate a docs page entry if there is a standalone entry with the same name', async () => {
        const csfSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.js',
          options
        );

        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/MetaOf.mdx',
          options
        );

        const generator = new StoryIndexGenerator([csfSpecifier, docsSpecifier], docsPageOptions);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--docs": Object {
                "id": "a--docs",
                "importPath": "./src/docs2/MetaOf.mdx",
                "name": "docs",
                "standalone": true,
                "storiesImports": Array [
                  "./src/A.stories.js",
                ],
                "title": "A",
                "type": "docs",
              },
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });

      it('generates a combined entry if there are two stories files for the same title', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './duplicate/*.stories.(ts|js|jsx)',
          options
        );

        const generator = new StoryIndexGenerator([specifier], docsPageOptions);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "duplicate-a--docs": Object {
                "id": "duplicate-a--docs",
                "importPath": "./duplicate/A.stories.js",
                "name": "docs",
                "standalone": false,
                "storiesImports": Array [
                  "./duplicate/SecondA.stories.js",
                ],
                "title": "duplicate/A",
                "type": "docs",
              },
              "duplicate-a--story-one": Object {
                "id": "duplicate-a--story-one",
                "importPath": "./duplicate/A.stories.js",
                "name": "Story One",
                "title": "duplicate/A",
                "type": "story",
              },
              "duplicate-a--story-two": Object {
                "id": "duplicate-a--story-two",
                "importPath": "./duplicate/SecondA.stories.js",
                "name": "Story Two",
                "title": "duplicate/A",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
    });

    describe('docs specifier', () => {
      it('creates correct docs entries', async () => {
        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], options);
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--docs": Object {
                "id": "a--docs",
                "importPath": "./src/docs2/MetaOf.mdx",
                "name": "docs",
                "standalone": true,
                "storiesImports": Array [
                  "./src/A.stories.js",
                ],
                "title": "A",
                "type": "docs",
              },
              "a--second-docs": Object {
                "id": "a--second-docs",
                "importPath": "./src/docs2/SecondMetaOf.mdx",
                "name": "Second Docs",
                "standalone": true,
                "storiesImports": Array [
                  "./src/A.stories.js",
                ],
                "title": "A",
                "type": "docs",
              },
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
              "docs2-yabbadabbadooo--docs": Object {
                "id": "docs2-yabbadabbadooo--docs",
                "importPath": "./src/docs2/Title.mdx",
                "name": "docs",
                "standalone": true,
                "storiesImports": Array [],
                "title": "docs2/Yabbadabbadooo",
                "type": "docs",
              },
              "notitle--docs": Object {
                "id": "notitle--docs",
                "importPath": "./src/docs2/NoTitle.mdx",
                "name": "docs",
                "standalone": true,
                "storiesImports": Array [],
                "title": "NoTitle",
                "type": "docs",
              },
            },
            "v": 4,
          }
        `);
      });

      it('generates no docs entries when docs are disabled', async () => {
        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], {
          ...options,
          docs: {
            ...options.docs,
            enabled: false,
          },
        });
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
            },
            "v": 4,
          }
        `);
      });
      it('Allows you to override default name for docs files', async () => {
        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], {
          ...options,
          docs: {
            ...options.docs,
            defaultName: 'Info',
          },
        });
        await generator.initialize();

        expect(await generator.getIndex()).toMatchInlineSnapshot(`
          Object {
            "entries": Object {
              "a--info": Object {
                "id": "a--info",
                "importPath": "./src/docs2/MetaOf.mdx",
                "name": "Info",
                "standalone": true,
                "storiesImports": Array [
                  "./src/A.stories.js",
                ],
                "title": "A",
                "type": "docs",
              },
              "a--second-docs": Object {
                "id": "a--second-docs",
                "importPath": "./src/docs2/SecondMetaOf.mdx",
                "name": "Second Docs",
                "standalone": true,
                "storiesImports": Array [
                  "./src/A.stories.js",
                ],
                "title": "A",
                "type": "docs",
              },
              "a--story-one": Object {
                "id": "a--story-one",
                "importPath": "./src/A.stories.js",
                "name": "Story One",
                "title": "A",
                "type": "story",
              },
              "docs2-yabbadabbadooo--info": Object {
                "id": "docs2-yabbadabbadooo--info",
                "importPath": "./src/docs2/Title.mdx",
                "name": "Info",
                "standalone": true,
                "storiesImports": Array [],
                "title": "docs2/Yabbadabbadooo",
                "type": "docs",
              },
              "notitle--info": Object {
                "id": "notitle--info",
                "importPath": "./src/docs2/NoTitle.mdx",
                "name": "Info",
                "standalone": true,
                "storiesImports": Array [],
                "title": "NoTitle",
                "type": "docs",
              },
            },
            "v": 4,
          }
        `);
      });
    });

    describe('errors', () => {
      it('when docs dependencies are missing', async () => {
        const generator = new StoryIndexGenerator(
          [normalizeStoriesEntry('./src/docs2/MetaOf.mdx', options)],
          options
        );
        await expect(() => generator.initialize()).rejects.toThrowError(
          /Could not find "..\/A.stories" for docs file/
        );
      });
    });

    describe('duplicates', () => {
      it('warns when two standalone entries reference the same CSF file without a name', async () => {
        const docsErrorSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './errors/DuplicateMetaOf.mdx',
          options
        );

        const generator = new StoryIndexGenerator(
          [storiesSpecifier, docsSpecifier, docsErrorSpecifier],
          options
        );
        await generator.initialize();

        expect(Object.keys((await generator.getIndex()).entries)).toMatchInlineSnapshot(`
          Array [
            "a--story-one",
            "a--docs",
            "notitle--docs",
            "a--second-docs",
            "docs2-yabbadabbadooo--docs",
          ]
        `);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(mocked(logger.warn).mock.calls[0][0]).toMatchInlineSnapshot(
          `"🚨 You have two component docs pages with the same name A:docs. Use \`<Meta of={} name=\\"Other Name\\">\` to distinguish them."`
        );
      });

      it('warns when a standalone entry has the same name as a story', async () => {
        const docsErrorSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './errors/MetaOfClashingName.mdx',
          options
        );

        const generator = new StoryIndexGenerator(
          [storiesSpecifier, docsSpecifier, docsErrorSpecifier],
          options
        );
        await generator.initialize();

        expect(Object.keys((await generator.getIndex()).entries)).toMatchInlineSnapshot(`
          Array [
            "a--story-one",
            "a--docs",
            "notitle--docs",
            "a--second-docs",
            "docs2-yabbadabbadooo--docs",
          ]
        `);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(mocked(logger.warn).mock.calls[0][0]).toMatchInlineSnapshot(
          `"🚨 You have a story for A with the same name as your component docs page (Story One), so the docs page is being dropped. Use \`<Meta of={} name=\\"Other Name\\">\` to distinguish them."`
        );
      });

      it('warns when a story has the default docs name', async () => {
        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], {
          ...options,
          docs: { ...options.docs, defaultName: 'Story One' },
        });
        await generator.initialize();

        expect(Object.keys((await generator.getIndex()).entries)).toMatchInlineSnapshot(`
          Array [
            "a--story-one",
            "notitle--story-one",
            "a--second-docs",
            "docs2-yabbadabbadooo--story-one",
          ]
        `);

        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(mocked(logger.warn).mock.calls[0][0]).toMatchInlineSnapshot(
          `"🚨 You have a story for A with the same name as your default docs entry name (Story One), so the docs page is being dropped. Consider changing the story name."`
        );
      });
    });
  });

  describe('sorting', () => {
    it('runs a user-defined sort function', async () => {
      const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
        './src/**/*.stories.(ts|js|jsx)',
        options
      );
      const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
        './src/docs2/*.mdx',
        options
      );

      const generator = new StoryIndexGenerator([docsSpecifier, storiesSpecifier], options);
      await generator.initialize();

      (getStorySortParameter as jest.Mock).mockReturnValueOnce({
        order: ['docs2', 'D', 'B', 'nested', 'A', 'second-nested', 'first-nested/deeply'],
      });

      expect(Object.keys((await generator.getIndex()).entries)).toMatchInlineSnapshot(`
        Array [
          "docs2-yabbadabbadooo--docs",
          "d--story-one",
          "b--story-one",
          "nested-button--story-one",
          "a--docs",
          "a--second-docs",
          "a--story-one",
          "second-nested-g--story-one",
          "notitle--docs",
          "first-nested-deeply-f--story-one",
        ]
      `);
    });
  });

  describe('caching', () => {
    describe('no invalidation', () => {
      it('does not extract csf files a second time', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        loadCsfMock.mockClear();
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(loadCsfMock).toHaveBeenCalledTimes(6);

        loadCsfMock.mockClear();
        await generator.getIndex();
        expect(loadCsfMock).not.toHaveBeenCalled();
      });

      it('does not extract docs files a second time', async () => {
        const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.(ts|js|jsx)',
          options
        );
        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/*.mdx',
          options
        );

        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(5);

        toIdMock.mockClear();
        await generator.getIndex();
        expect(toId).not.toHaveBeenCalled();
      });

      it('does not call the sort function a second time', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        const sortFn = jest.fn();
        getStorySortParameterMock.mockReturnValue(sortFn);
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(sortFn).toHaveBeenCalled();

        sortFn.mockClear();
        await generator.getIndex();
        expect(sortFn).not.toHaveBeenCalled();
      });
    });

    describe('file changed', () => {
      it('calls extract csf file for just the one file', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        loadCsfMock.mockClear();
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(loadCsfMock).toHaveBeenCalledTimes(6);

        generator.invalidate(specifier, './src/B.stories.ts', false);

        loadCsfMock.mockClear();
        await generator.getIndex();
        expect(loadCsfMock).toHaveBeenCalledTimes(1);
      });

      it('calls extract docs file for just the one file', async () => {
        const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.(ts|js|jsx)',
          options
        );
        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/*.mdx',
          options
        );

        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(5);

        generator.invalidate(docsSpecifier, './src/docs2/Title.mdx', false);

        toIdMock.mockClear();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(1);
      });

      it('calls extract for a csf file and any of its docs dependents', async () => {
        const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.(ts|js|jsx)',
          options
        );
        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/*.mdx',
          options
        );

        const generator = new StoryIndexGenerator([storiesSpecifier, docsSpecifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(5);

        generator.invalidate(storiesSpecifier, './src/A.stories.js', false);

        toIdMock.mockClear();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(3);
      });

      it('does call the sort function a second time', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        const sortFn = jest.fn();
        getStorySortParameterMock.mockReturnValue(sortFn);
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(sortFn).toHaveBeenCalled();

        generator.invalidate(specifier, './src/B.stories.ts', false);

        sortFn.mockClear();
        await generator.getIndex();
        expect(sortFn).toHaveBeenCalled();
      });
    });

    describe('file removed', () => {
      it('does not extract csf files a second time', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        loadCsfMock.mockClear();
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(loadCsfMock).toHaveBeenCalledTimes(6);

        generator.invalidate(specifier, './src/B.stories.ts', true);

        loadCsfMock.mockClear();
        await generator.getIndex();
        expect(loadCsfMock).not.toHaveBeenCalled();
      });

      it('does call the sort function a second time', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        const sortFn = jest.fn();
        getStorySortParameterMock.mockReturnValue(sortFn);
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(sortFn).toHaveBeenCalled();

        generator.invalidate(specifier, './src/B.stories.ts', true);

        sortFn.mockClear();
        await generator.getIndex();
        expect(sortFn).toHaveBeenCalled();
      });

      it('does not include the deleted stories in results', async () => {
        const specifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/**/*.stories.(ts|js|jsx)',
          options
        );

        loadCsfMock.mockClear();
        const generator = new StoryIndexGenerator([specifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(loadCsfMock).toHaveBeenCalledTimes(6);

        generator.invalidate(specifier, './src/B.stories.ts', true);

        expect(Object.keys((await generator.getIndex()).entries)).not.toContain('b--story-one');
      });

      it('does not include the deleted docs in results', async () => {
        const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.(ts|js|jsx)',
          options
        );
        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/*.mdx',
          options
        );

        const generator = new StoryIndexGenerator([docsSpecifier, storiesSpecifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(5);

        expect(Object.keys((await generator.getIndex()).entries)).toContain('notitle--docs');

        generator.invalidate(docsSpecifier, './src/docs2/NoTitle.mdx', true);

        expect(Object.keys((await generator.getIndex()).entries)).not.toContain('notitle--docs');
      });

      it('errors on dependency deletion', async () => {
        const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.(ts|js|jsx)',
          options
        );
        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/*.mdx',
          options
        );

        const generator = new StoryIndexGenerator([docsSpecifier, storiesSpecifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(5);

        expect(Object.keys((await generator.getIndex()).entries)).toContain('a--story-one');

        generator.invalidate(storiesSpecifier, './src/A.stories.js', true);

        await expect(() => generator.getIndex()).rejects.toThrowError(
          /Could not find "..\/A.stories" for docs file/
        );
      });

      it('cleans up properly on dependent docs deletion', async () => {
        const storiesSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/A.stories.(ts|js|jsx)',
          options
        );
        const docsSpecifier: NormalizedStoriesSpecifier = normalizeStoriesEntry(
          './src/docs2/*.mdx',
          options
        );

        const generator = new StoryIndexGenerator([docsSpecifier, storiesSpecifier], options);
        await generator.initialize();
        await generator.getIndex();
        expect(toId).toHaveBeenCalledTimes(5);

        expect(Object.keys((await generator.getIndex()).entries)).toContain('a--docs');

        generator.invalidate(docsSpecifier, './src/docs2/MetaOf.mdx', true);

        expect(Object.keys((await generator.getIndex()).entries)).not.toContain('a--docs');

        // this will throw if MetaOf is not removed from A's dependents
        generator.invalidate(storiesSpecifier, './src/A.stories.js', false);
      });
    });
  });
});
