import { AnyFramework, StoryId, ViewMode, StoryContextForLoaders } from '@storybook/csf';
import { Story, StoryStore, IndexEntry } from '@storybook/store';
import { Channel } from '@storybook/addons';
import { Render, RenderType } from './Render';
import { DocsContextProps } from '../types';

export abstract class AbstractDocsRender<TFramework extends AnyFramework>
  implements Render<TFramework>
{
  public type: RenderType = 'docs';

  public id: StoryId;

  protected preparing = false;

  protected canvasElement?: HTMLElement;

  protected docsContext?: DocsContextProps<TFramework>;

  public disableKeyListeners = false;

  public teardown?: (options: { viewModeChanged?: boolean }) => Promise<void>;

  public torndown = false;

  constructor(
    protected channel: Channel,
    protected store: StoryStore<TFramework>,
    public entry: IndexEntry
  ) {
    this.id = entry.id;
  }

  isPreparing() {
    return this.preparing;
  }

  loadStory = (storyId: StoryId) => this.store.loadStory({ storyId });

  getStoryContext = (renderedStory: Story<TFramework>) =>
    ({
      ...this.store.getStoryContext(renderedStory),
      viewMode: 'docs' as ViewMode,
    } as StoryContextForLoaders<TFramework>);

  async renderToElement(
    canvasElement: HTMLElement,
    renderStoryToElement: DocsContextProps['renderStoryToElement']
  ) {
    this.canvasElement = canvasElement;
    this.docsContext = await this.getDocsContext(renderStoryToElement);

    return this.render();
  }

  abstract isEqual(r: Render<TFramework>): boolean;

  abstract render(): Promise<void>;

  abstract getDocsContext(
    renderStoryToElement: DocsContextProps<TFramework>['renderStoryToElement']
  ): Promise<DocsContextProps<TFramework>>;
}
