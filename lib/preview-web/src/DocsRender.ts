import { AnyFramework, StoryId, ViewMode, StoryContextForLoaders } from '@storybook/csf';
import {
  Story,
  StoryStore,
  CSFFile,
  ModuleExports,
  IndexEntry,
  ModuleExport,
} from '@storybook/store';
import { Channel } from '@storybook/addons';
import { DOCS_RENDERED } from '@storybook/core-events';

import { Render, RenderType } from './StoryRender';
import type { DocsContextProps, DocsRenderFunction } from './types';

export class DocsRender<TFramework extends AnyFramework> implements Render<TFramework> {
  public type: RenderType = 'docs';

  public id: StoryId;

  public legacy: boolean;

  public story?: Story<TFramework>;

  public exports?: ModuleExports;

  private csfFiles?: CSFFile<TFramework>[];

  private preparing = false;

  private canvasElement?: HTMLElement;

  private docsContext?: DocsContextProps<TFramework>;

  public disableKeyListeners = false;

  public teardown?: (options: { viewModeChanged?: boolean }) => Promise<void>;

  public torndown = false;

  constructor(
    private channel: Channel,
    private store: StoryStore<TFramework>,
    public entry: IndexEntry
  ) {
    this.id = entry.id;
    this.legacy = entry.type !== 'docs' || !entry.standalone;
  }

  // The two story "renders" are equal and have both loaded the same story
  isEqual(other?: Render<TFramework>) {
    if (!other) return false;
    return this.id === other.id && this.legacy
      ? this.story && this.story === other.story
      : other.type === 'docs' && this.entry === (other as DocsRender<TFramework>).entry;
  }

  async prepare() {
    this.preparing = true;
    if (this.legacy) {
      this.story = await this.store.loadStory({ storyId: this.id });
    } else {
      const { docsExports, csfFiles } = await this.store.loadDocsFileById(this.id);
      this.exports = docsExports;
      this.csfFiles = csfFiles;
    }
    this.preparing = false;
  }

  isPreparing() {
    return this.preparing;
  }

  async getDocsContext(
    renderStoryToElement: DocsContextProps<TFramework>['renderStoryToElement']
  ): Promise<DocsContextProps<TFramework>> {
    const { id, title, name } = this.entry;

    const base = {
      type: this.legacy ? 'legacy' : ('modern' as DocsContextProps['type']),
      id,
      title,
      name,
      loadStory: (storyId: StoryId) => this.store.loadStory({ storyId }),
      renderStoryToElement,
      getStoryContext: (renderedStory: Story<TFramework>) =>
        ({
          ...this.store.getStoryContext(renderedStory),
          viewMode: 'docs' as ViewMode,
        } as StoryContextForLoaders<TFramework>),
    };

    if (this.legacy) {
      const csfFile: CSFFile<TFramework> = await this.store.loadCSFFileByStoryId(this.id);
      const componentStories = () => this.store.componentStoriesFromCSFFile({ csfFile });
      return {
        ...base,

        storyIdByModuleExport: () => {
          // NOTE: we could implement this easily enough by checking all the component stories
          throw new Error('`storyIdByModuleExport` not available for legacy docs files.');
        },
        storyById: (storyId: StoryId) => this.store.storyFromCSFFile({ storyId, csfFile }),

        componentStories,
        setMeta: () => {},
      };
    }

    if (!this.csfFiles) throw new Error('getDocsContext called before prepare');

    let metaCsfFile: ModuleExports;
    const exportToStoryId = new Map<ModuleExport, StoryId>();
    const storyIdToCSFFile = new Map<StoryId, CSFFile<TFramework>>();
    // eslint-disable-next-line no-restricted-syntax
    for (const csfFile of this.csfFiles) {
      // eslint-disable-next-line no-restricted-syntax
      for (const annotation of Object.values(csfFile.stories)) {
        exportToStoryId.set(annotation.moduleExport, annotation.id);
        storyIdToCSFFile.set(annotation.id, csfFile);
      }
    }
    const storyById = (storyId: StoryId) => {
      const csfFile = storyIdToCSFFile.get(storyId);
      if (!csfFile)
        throw new Error(`Called \`storyById\` for story that was never loaded: ${storyId}`);
      return this.store.storyFromCSFFile({ storyId, csfFile });
    };

    return {
      ...base,
      storyIdByModuleExport: (moduleExport) => {
        const storyId = exportToStoryId.get(moduleExport);
        if (storyId) return storyId;

        throw new Error(`No story found with that export: ${moduleExport}`);
      },
      storyById,
      componentStories: () => {
        return (
          Object.entries(metaCsfFile)
            .map(([_, moduleExport]) => exportToStoryId.get(moduleExport))
            .filter(Boolean) as StoryId[]
        ).map(storyById);
      },
      setMeta(m: ModuleExports) {
        metaCsfFile = m;
      },
    };
  }

  async renderToElement(
    canvasElement: HTMLElement,
    renderStoryToElement: DocsContextProps['renderStoryToElement']
  ) {
    this.canvasElement = canvasElement;
    this.docsContext = await this.getDocsContext(renderStoryToElement);

    return this.render();
  }

  async render() {
    if (
      !(this.story || this.exports) ||
      !this.docsContext ||
      !this.canvasElement ||
      !this.store.projectAnnotations
    )
      throw new Error('DocsRender not ready to render');

    const { docs } = this.story?.parameters || this.store.projectAnnotations.parameters || {};

    if (!docs) {
      throw new Error(
        `Cannot render a story in viewMode=docs if \`@storybook/addon-docs\` is not installed`
      );
    }

    const renderer = await docs.renderer();
    (renderer.render as DocsRenderFunction<TFramework>)(
      this.docsContext,
      {
        ...docs,
        // exports must be defined in non-legacy mode (see check at top)
        ...(!this.legacy && { page: this.exports!.default }),
      },
      this.canvasElement,
      () => this.channel.emit(DOCS_RENDERED, this.id)
    );
    this.teardown = async ({ viewModeChanged }: { viewModeChanged?: boolean } = {}) => {
      if (!viewModeChanged || !this.canvasElement) return;
      renderer.unmount(this.canvasElement);
      this.torndown = true;
    };
  }

  async rerender() {
    // We don't need to do anything here, as the stories will individually re-render
  }
}
