import { SynchronousPromise } from 'synchronous-promise';
import type {
  DecoratorFunction,
  Args,
  StoryContextForEnhancers,
  StoryId,
  StoryName,
  StoryIdentifier,
  ViewMode,
  LegacyStoryFn,
  StoryContextForLoaders,
  StoryContext,
  ComponentTitle,
  AnyFramework,
  ProjectAnnotations,
  ComponentAnnotations,
  StoryAnnotations,
  StoryFn,
  StrictArgTypes,
  StrictGlobalTypes,
  ComponentId,
  PartialStoryFn,
  Parameters,
} from '@storybook/csf';
import type {
  StoryIndexEntry,
  DocsIndexEntry,
  TemplateDocsIndexEntry,
  StandaloneDocsIndexEntry,
  IndexEntry,
} from '@storybook/addons';

export type {
  StoryIndexEntry,
  DocsIndexEntry,
  IndexEntry,
  TemplateDocsIndexEntry,
  StandaloneDocsIndexEntry,
};
export type { StoryId, Parameters };
export type Path = string;
export type ModuleExport = any;
export type ModuleExports = Record<string, ModuleExport>;
export type PromiseLike<T> = Promise<T> | SynchronousPromise<T>;
export type ModuleImportFn = (path: Path) => PromiseLike<ModuleExports>;

type MaybePromise<T> = Promise<T> | T;

export type TeardownRenderToDOM = () => MaybePromise<void>;
export type RenderToDOM<TFramework extends AnyFramework> = (
  context: RenderContext<TFramework>,
  element: Element
) => MaybePromise<void | TeardownRenderToDOM>;

export type WebProjectAnnotations<TFramework extends AnyFramework> =
  ProjectAnnotations<TFramework> & {
    renderToDOM?: RenderToDOM<TFramework>;
  };

export type NormalizedProjectAnnotations<TFramework extends AnyFramework = AnyFramework> =
  ProjectAnnotations<TFramework> & {
    argTypes?: StrictArgTypes;
    globalTypes?: StrictGlobalTypes;
  };

export type NormalizedComponentAnnotations<TFramework extends AnyFramework = AnyFramework> =
  ComponentAnnotations<TFramework> & {
    // Useful to guarantee that id & title exists
    id: ComponentId;
    title: ComponentTitle;
    argTypes?: StrictArgTypes;
  };

export type NormalizedStoryAnnotations<TFramework extends AnyFramework = AnyFramework> = Omit<
  StoryAnnotations<TFramework>,
  'storyName' | 'story'
> & {
  moduleExport: ModuleExport;
  // You cannot actually set id on story annotations, but we normalize it to be there for convience
  id: StoryId;
  argTypes?: StrictArgTypes;
  name: StoryName;
  userStoryFn?: StoryFn<TFramework>;
};

export type CSFFile<TFramework extends AnyFramework = AnyFramework> = {
  meta: NormalizedComponentAnnotations<TFramework>;
  stories: Record<StoryId, NormalizedStoryAnnotations<TFramework>>;
};

export type Story<TFramework extends AnyFramework = AnyFramework> =
  StoryContextForEnhancers<TFramework> & {
    moduleExport: ModuleExport;
    originalStoryFn: StoryFn<TFramework>;
    undecoratedStoryFn: LegacyStoryFn<TFramework>;
    unboundStoryFn: LegacyStoryFn<TFramework>;
    applyLoaders: (
      context: StoryContextForLoaders<TFramework>
    ) => Promise<
      StoryContextForLoaders<TFramework> & { loaded: StoryContext<TFramework>['loaded'] }
    >;
    playFunction?: (context: StoryContext<TFramework>) => Promise<void> | void;
  };

export type BoundStory<TFramework extends AnyFramework = AnyFramework> = Story<TFramework> & {
  storyFn: PartialStoryFn<TFramework>;
};

export declare type RenderContext<TFramework extends AnyFramework = AnyFramework> =
  StoryIdentifier & {
    showMain: () => void;
    showError: (error: { title: string; description: string }) => void;
    showException: (err: Error) => void;
    forceRemount: boolean;
    storyContext: StoryContext<TFramework>;
    storyFn: PartialStoryFn<TFramework>;
    unboundStoryFn: LegacyStoryFn<TFramework>;
  };

export interface V2CompatIndexEntry extends Omit<StoryIndexEntry, 'type'> {
  kind: StoryIndexEntry['title'];
  story: StoryIndexEntry['name'];
  parameters: Parameters;
}

export interface StoryIndexV3 {
  v: number;
  stories: Record<StoryId, V2CompatIndexEntry>;
}

export interface StoryIndex {
  v: number;
  entries: Record<StoryId, IndexEntry>;
}

export type StorySpecifier = StoryId | { name: StoryName; title: ComponentTitle } | '*';

export interface SelectionSpecifier {
  storySpecifier: StorySpecifier;
  viewMode: ViewMode;
  args?: Args;
  globals?: Args;
}

export interface Selection {
  storyId: StoryId;
  viewMode: ViewMode;
}

export type DecoratorApplicator<TFramework extends AnyFramework = AnyFramework> = (
  storyFn: LegacyStoryFn<TFramework>,
  decorators: DecoratorFunction<TFramework>[]
) => LegacyStoryFn<TFramework>;

export interface StoriesSpecifier {
  directory: string;
  titlePrefix?: string;
}
export interface NormalizedStoriesSpecifier {
  glob?: string;
  specifier?: StoriesSpecifier;
}

export type ExtractOptions = {
  includeDocsOnly?: boolean;
};
