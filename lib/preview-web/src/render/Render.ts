import { StoryId, AnyFramework } from '@storybook/csf';
import { Story } from '@storybook/store';

export type RenderType = 'story' | 'docs';
export interface Render<TFramework extends AnyFramework> {
  type: RenderType;
  id: StoryId;
  isPreparing: () => boolean;
  isEqual: (other: Render<TFramework>) => boolean;
  disableKeyListeners: boolean;
  teardown?: (options: { viewModeChanged: boolean }) => Promise<void>;
  torndown: boolean;
  renderToElement: (canvasElement: HTMLElement, renderStoryToElement?: any) => Promise<void>;
}
