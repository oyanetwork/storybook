import path from 'path';
import fs from 'fs-extra';
import glob from 'globby';
import slash from 'slash';

import type {
  Path,
  StoryIndex,
  V2CompatIndexEntry,
  StoryId,
  IndexEntry,
  DocsIndexEntry,
} from '@storybook/store';
import { userOrAutoTitleFromSpecifier, sortStoriesV7 } from '@storybook/store';
import type {
  StoryIndexer,
  IndexerOptions,
  NormalizedStoriesSpecifier,
  DocsOptions,
} from '@storybook/core-common';
import { normalizeStoryPath } from '@storybook/core-common';
import { logger } from '@storybook/node-logger';
import { getStorySortParameter } from '@storybook/csf-tools';
import type { ComponentTitle } from '@storybook/csf';
import { toId } from '@storybook/csf';

type DocsCacheEntry = DocsIndexEntry;
type StoriesCacheEntry = { entries: IndexEntry[]; dependents: Path[]; type: 'stories' };
type CacheEntry = false | StoriesCacheEntry | DocsCacheEntry;
type SpecifierStoriesCache = Record<Path, CacheEntry>;

const makeAbsolute = (otherImport: Path, normalizedPath: Path, workingDir: Path) =>
  otherImport.startsWith('.')
    ? slash(
        path.resolve(
          workingDir,
          normalizeStoryPath(path.join(path.dirname(normalizedPath), otherImport))
        )
      )
    : otherImport;

export class StoryIndexGenerator {
  // An internal cache mapping specifiers to a set of path=><set of stories>
  // Later, we'll combine each of these subsets together to form the full index
  private specifierToCache: Map<NormalizedStoriesSpecifier, SpecifierStoriesCache>;

  // Cache the last value of `getStoryIndex`. We invalidate (by unsetting) when:
  //  - any file changes, including deletions
  //  - the preview changes [not yet implemented]
  private lastIndex?: StoryIndex;

  constructor(
    public readonly specifiers: NormalizedStoriesSpecifier[],
    public readonly options: {
      workingDir: Path;
      configDir: Path;
      storiesV2Compatibility: boolean;
      storyStoreV7: boolean;
      storyIndexers: StoryIndexer[];
      docs: DocsOptions;
    }
  ) {
    this.specifierToCache = new Map();
  }

  async initialize() {
    // Find all matching paths for each specifier
    await Promise.all(
      this.specifiers.map(async (specifier) => {
        const pathToSubIndex = {} as SpecifierStoriesCache;

        const fullGlob = slash(
          path.join(this.options.workingDir, specifier.directory, specifier.files)
        );
        const files = await glob(fullGlob);
        files.sort().forEach((absolutePath: Path) => {
          const ext = path.extname(absolutePath);
          if (ext === '.storyshot') {
            const relativePath = path.relative(this.options.workingDir, absolutePath);
            logger.info(`Skipping ${ext} file ${relativePath}`);
            return;
          }

          pathToSubIndex[absolutePath] = false;
        });

        this.specifierToCache.set(specifier, pathToSubIndex);
      })
    );

    // Extract stories for each file
    await this.ensureExtracted();
  }

  /**
   * Run the updater function over all the empty cache entries
   */
  async updateExtracted(
    updater: (specifier: NormalizedStoriesSpecifier, absolutePath: Path) => Promise<CacheEntry>
  ) {
    await Promise.all(
      this.specifiers.map(async (specifier) => {
        const entry = this.specifierToCache.get(specifier);
        return Promise.all(
          Object.keys(entry).map(async (absolutePath) => {
            entry[absolutePath] = entry[absolutePath] || (await updater(specifier, absolutePath));
          })
        );
      })
    );
  }

  isDocsMdx(absolutePath: Path) {
    return /(?<!\.stories)\.mdx$/i.test(absolutePath);
  }

  async ensureExtracted(): Promise<IndexEntry[]> {
    // First process all the story files. Then, in a second pass,
    // process the docs files. The reason for this is that the docs
    // files may use the `<Meta of={XStories} />` syntax, which requires
    // that the story file that contains the meta be processed first.
    await this.updateExtracted(async (specifier, absolutePath) =>
      this.isDocsMdx(absolutePath) ? false : this.extractStories(specifier, absolutePath)
    );

    if (this.options.docs.enabled) {
      await this.updateExtracted(async (specifier, absolutePath) =>
        this.extractDocs(specifier, absolutePath)
      );
    }

    return this.specifiers.flatMap((specifier) => {
      const cache = this.specifierToCache.get(specifier);
      return Object.values(cache).flatMap((entry) => {
        if (!entry) return [];
        if (entry.type === 'docs') return [entry];
        return entry.entries;
      });
    });
  }

  findDependencies(absoluteImports: Path[]) {
    const dependencies = [] as StoriesCacheEntry[];
    const foundImports = new Set();
    this.specifierToCache.forEach((cache) => {
      const fileNames = Object.keys(cache).filter((fileName) => {
        const foundImport = absoluteImports.find((storyImport) => fileName.startsWith(storyImport));
        if (foundImport) foundImports.add(foundImport);
        return !!foundImport;
      });
      fileNames.forEach((fileName) => {
        const cacheEntry = cache[fileName];
        if (cacheEntry && cacheEntry.type === 'stories') {
          dependencies.push(cacheEntry);
        } else {
          throw new Error(`Unexpected dependency: ${cacheEntry}`);
        }
      });
    });

    // imports can include non-story imports, so it's ok if
    // there are fewer foundImports than absoluteImports
    // if (absoluteImports.length !== foundImports.size) {
    //   throw new Error(`Missing dependencies: ${absoluteImports.filter((p) => !foundImports.has(p))}`));
    // }

    return dependencies;
  }

  async extractDocs(specifier: NormalizedStoriesSpecifier, absolutePath: Path) {
    const relativePath = path.relative(this.options.workingDir, absolutePath);
    try {
      if (!this.options.storyStoreV7) {
        throw new Error(`You cannot use \`.mdx\` files without using \`storyStoreV7\`.`);
      }

      const normalizedPath = normalizeStoryPath(relativePath);
      const importPath = slash(normalizedPath);

      // This `await require(...)` is a bit of a hack. It's necessary because
      // `docs-mdx` depends on ESM code, which must be asynchronously imported
      // to be used in CJS. Unfortunately, we cannot use `import()` here, because
      // it will be transpiled down to `require()` by Babel. So instead, we require
      // a CJS export from `@storybook/docs-mdx` that does the `async import` for us.

      // eslint-disable-next-line global-require
      const { analyze } = await require('@storybook/docs-mdx');
      const content = await fs.readFile(absolutePath, 'utf8');
      // { title?, of?, imports? }
      const result = analyze(content);

      const absoluteImports = (result.imports as string[]).map((p) =>
        makeAbsolute(p, normalizedPath, this.options.workingDir)
      );

      // Go through the cache and collect all of the cache entries that this docs file depends on.
      // We'll use this to make sure this docs cache entry is invalidated when any of its dependents
      // are invalidated.
      const dependencies = this.findDependencies(absoluteImports);

      // Also, if `result.of` is set, it means that we're using the `<Meta of={XStories} />` syntax,
      // so find the `title` defined the file that `meta` points to.
      let ofTitle: string;
      if (result.of) {
        const absoluteOf = makeAbsolute(result.of, normalizedPath, this.options.workingDir);
        dependencies.forEach((dep) => {
          if (dep.entries.length > 0) {
            const first = dep.entries[0];
            if (path.resolve(this.options.workingDir, first.importPath).startsWith(absoluteOf)) {
              ofTitle = first.title;
            }
          }
        });

        if (!ofTitle)
          throw new Error(`Could not find "${result.of}" for docs file "${relativePath}".`);
      }

      // Track that we depend on this for easy invalidation later.
      dependencies.forEach((dep) => {
        dep.dependents.push(absolutePath);
      });

      const title = userOrAutoTitleFromSpecifier(importPath, specifier, result.title || ofTitle);
      const name = this.options.docs.defaultName;
      const id = toId(title, name);

      const docsEntry: DocsCacheEntry = {
        id,
        title,
        name,
        importPath,
        storiesImports: dependencies.map((dep) => dep.entries[0].importPath),
        type: 'docs',
      };
      return docsEntry;
    } catch (err) {
      logger.warn(`🚨 Extraction error on ${relativePath}: ${err}`);
      throw err;
    }
  }

  async index(filePath: string, options: IndexerOptions) {
    const storyIndexer = this.options.storyIndexers.find((indexer) => indexer.test.exec(filePath));
    if (!storyIndexer) {
      throw new Error(`No matching story indexer found for ${filePath}`);
    }
    return storyIndexer.indexer(filePath, options);
  }

  async extractStories(specifier: NormalizedStoriesSpecifier, absolutePath: Path) {
    const relativePath = path.relative(this.options.workingDir, absolutePath);
    const entries = [] as IndexEntry[];
    try {
      const importPath = slash(normalizeStoryPath(relativePath));
      const makeTitle = (userTitle?: string) => {
        return userOrAutoTitleFromSpecifier(importPath, specifier, userTitle);
      };
      const csf = await this.index(absolutePath, { makeTitle });
      csf.stories.forEach(({ id, name, parameters }) => {
        const base = { id, title: csf.meta.title, name, importPath };

        if (parameters?.docsOnly) {
          if (this.options.docs.enabled) {
            entries.push({ ...base, type: 'docs', storiesImports: [], legacy: true });
          }
        } else {
          entries.push({ ...base, type: 'story' });
        }
      });
    } catch (err) {
      if (err.name === 'NoMetaError') {
        logger.info(`💡 Skipping ${relativePath}: ${err}`);
      } else {
        logger.warn(`🚨 Extraction error on ${relativePath}: ${err}`);
        throw err;
      }
    }
    return { entries, type: 'stories', dependents: [] } as StoriesCacheEntry;
  }

  async sortStories(storiesList: IndexEntry[]) {
    const entries: StoryIndex['entries'] = {};

    storiesList.forEach((entry) => {
      entries[entry.id] = entry;
    });

    const sortableStories = Object.values(entries);

    // Skip sorting if we're in v6 mode because we don't have
    // all the info we need here
    if (this.options.storyStoreV7) {
      const storySortParameter = await this.getStorySortParameter();
      const fileNameOrder = this.storyFileNames();
      sortStoriesV7(sortableStories, storySortParameter, fileNameOrder);
    }

    return sortableStories.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {} as StoryIndex['entries']);
  }

  async getIndex() {
    if (this.lastIndex) return this.lastIndex;

    // Extract any entries that are currently missing
    // Pull out each file's stories into a list of stories, to be composed and sorted
    const storiesList = await this.ensureExtracted();
    const sorted = await this.sortStories(storiesList);

    let compat = sorted;
    if (this.options.storiesV2Compatibility) {
      const titleToStoryCount = Object.values(sorted).reduce((acc, story) => {
        acc[story.title] = (acc[story.title] || 0) + 1;
        return acc;
      }, {} as Record<ComponentTitle, number>);

      // @ts-ignore
      compat = Object.entries(sorted).reduce((acc, entry) => {
        const [id, story] = entry;
        if (story.type === 'docs') return acc;

        acc[id] = {
          ...story,
          kind: story.title,
          story: story.name,
          parameters: {
            __id: story.id,
            docsOnly: titleToStoryCount[story.title] === 1 && story.name === 'Page',
            fileName: story.importPath,
          },
        };
        return acc;
      }, {} as Record<StoryId, V2CompatIndexEntry>);
    }

    this.lastIndex = {
      v: 4,
      entries: compat,
    };

    return this.lastIndex;
  }

  invalidate(specifier: NormalizedStoriesSpecifier, importPath: Path, removed: boolean) {
    const absolutePath = slash(path.resolve(this.options.workingDir, importPath));
    const cache = this.specifierToCache.get(specifier);

    const cacheEntry = cache[absolutePath];
    if (cacheEntry && cacheEntry.type === 'stories') {
      const { dependents } = cacheEntry;

      const invalidated = new Set();
      // the dependent can be in ANY cache, so we loop over all of them
      this.specifierToCache.forEach((otherCache) => {
        dependents.forEach((dep) => {
          if (otherCache[dep]) {
            invalidated.add(dep);
            // eslint-disable-next-line no-param-reassign
            otherCache[dep] = false;
          }
        });
      });

      const notFound = dependents.filter((dep) => !invalidated.has(dep));
      if (notFound.length > 0) {
        throw new Error(`Could not invalidate ${notFound.length} deps: ${notFound.join(', ')}`);
      }
    }

    if (removed) {
      if (cacheEntry && cacheEntry.type === 'docs') {
        const absoluteImports = cacheEntry.storiesImports.map((p) =>
          path.resolve(this.options.workingDir, p)
        );
        const dependencies = this.findDependencies(absoluteImports);
        dependencies.forEach((dep) =>
          dep.dependents.splice(dep.dependents.indexOf(absolutePath), 1)
        );
      }
      delete cache[absolutePath];
    } else {
      cache[absolutePath] = false;
    }
    this.lastIndex = null;
  }

  async getStorySortParameter() {
    const previewFile = ['js', 'jsx', 'ts', 'tsx']
      .map((ext) => path.join(this.options.configDir, `preview.${ext}`))
      .find((fname) => fs.existsSync(fname));
    let storySortParameter;
    if (previewFile) {
      const previewCode = (await fs.readFile(previewFile, 'utf-8')).toString();
      storySortParameter = await getStorySortParameter(previewCode);
    }

    return storySortParameter;
  }

  // Get the story file names in "imported order"
  storyFileNames() {
    return Array.from(this.specifierToCache.values()).flatMap((r) => Object.keys(r));
  }
}
