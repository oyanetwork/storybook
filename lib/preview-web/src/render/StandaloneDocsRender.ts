import { AnyFramework, StoryId } from '@storybook/csf';
import { CSFFile, ModuleExports, ModuleExport } from '@storybook/store';
import { DOCS_RENDERED } from '@storybook/core-events';

import { Render, RenderType } from './Render';
import type { DocsContextProps, DocsRenderFunction } from '../types';
import { AbstractDocsRender } from './AbstractDocsRender';

export class StandaloneDocsRender<
  TFramework extends AnyFramework
> extends AbstractDocsRender<TFramework> {
  public type: RenderType = 'docs';

  public exports?: ModuleExports;

  private csfFiles?: CSFFile<TFramework>[];

  async prepare() {
    this.preparing = true;
    const { docsExports, csfFiles } = await this.store.loadDocsFileById(this.id);
    this.exports = docsExports;
    this.csfFiles = csfFiles;
    this.preparing = false;
  }

  isEqual(other: Render<TFramework>) {
    return !!(
      this.id === other.id &&
      this.entry &&
      this.entry === (other as StandaloneDocsRender<TFramework>).entry
    );
  }

  async getDocsContext(
    renderStoryToElement: DocsContextProps<TFramework>['renderStoryToElement']
  ): Promise<DocsContextProps<TFramework>> {
    const { id, title, name } = this.entry;

    if (!this.csfFiles) throw new Error('getDocsContext called before prepare');

    let metaCsfFile: ModuleExports;
    const setMeta = (m: ModuleExports) => {
      metaCsfFile = m;
    };

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

    const storyIdByModuleExport = (moduleExport: ModuleExport) => {
      const storyId = exportToStoryId.get(moduleExport);
      if (storyId) return storyId;

      throw new Error(`No story found with that export: ${moduleExport}`);
    };

    const storyById = (storyId: StoryId) => {
      const csfFile = storyIdToCSFFile.get(storyId);
      if (!csfFile)
        throw new Error(`Called \`storyById\` for story that was never loaded: ${storyId}`);
      return this.store.storyFromCSFFile({ storyId, csfFile });
    };

    const componentStories = () => {
      return (
        Object.entries(metaCsfFile)
          .map(([_, moduleExport]) => exportToStoryId.get(moduleExport))
          .filter(Boolean) as StoryId[]
      ).map(storyById);
    };

    return {
      // TODO
      type: 'modern',
      id,
      title,
      name,
      renderStoryToElement,
      loadStory: this.loadStory,
      getStoryContext: this.getStoryContext,
      storyIdByModuleExport,
      storyById,
      componentStories,
      setMeta,
    };
  }

  async render() {
    if (!this.exports || !this.docsContext || !this.canvasElement || !this.store.projectAnnotations)
      throw new Error('DocsRender not ready to render');

    const { docs } = this.store.projectAnnotations.parameters || {};

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
        page: this.exports.default,
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
}
