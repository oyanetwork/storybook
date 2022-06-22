import global from 'global';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { useChannel, useParameter, StoryId } from '@storybook/api';
import {
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  FORCE_REMOUNT,
} from '@storybook/core-events';
import { AddonPanel, Code, Link, Placeholder } from '@storybook/components';
import { EVENTS, Call, CallStates, ControlStates, LogItem } from '@storybook/instrumenter';
import { styled } from '@storybook/theming';

import { StatusIcon } from './components/StatusIcon/StatusIcon';
import { Subnav } from './components/Subnav/Subnav';
import { Interaction } from './components/Interaction/Interaction';

export interface Controls {
  start: (args: any) => void;
  back: (args: any) => void;
  goto: (args: any) => void;
  next: (args: any) => void;
  end: (args: any) => void;
  rerun: (args: any) => void;
}

interface AddonPanelProps {
  active: boolean;
}

interface InteractionsPanelProps {
  active: boolean;
  controls: Controls;
  controlStates: ControlStates;
  interactions: (Call & {
    status?: CallStates;
    childCallIds: Call['id'][];
    isCollapsed: boolean;
    toggleCollapsed: () => void;
  })[];
  fileName?: string;
  hasException?: boolean;
  caughtException?: Error;
  isPlaying?: boolean;
  pausedAt?: Call['id'];
  calls: Map<string, any>;
  endRef?: React.Ref<HTMLDivElement>;
  onScrollToEnd?: () => void;
  isRerunAnimating: boolean;
  setIsRerunAnimating: React.Dispatch<React.SetStateAction<boolean>>;
}

const INITIAL_CONTROL_STATES = {
  debugger: false,
  start: false,
  back: false,
  goto: false,
  next: false,
  end: false,
};

const TabIcon = styled(StatusIcon)({
  marginLeft: 5,
});

const TabStatus = ({ children }: { children: React.ReactChild }) => {
  const container = global.document.getElementById('tabbutton-interactions');
  return container && ReactDOM.createPortal(children, container);
};

const Container = styled.div<{ hasException: boolean }>(({ theme, hasException }) => ({
  minHeight: '100%',
  background: hasException ? theme.background.warning : theme.background.content,
}));

const CaughtException = styled.div(({ theme }) => ({
  padding: 15,
  fontSize: theme.typography.size.s2 - 1,
  lineHeight: '19px',
}));
const CaughtExceptionCode = styled.code(({ theme }) => ({
  margin: '0 1px',
  padding: 3,
  fontSize: theme.typography.size.s1 - 1,
  lineHeight: 1,
  verticalAlign: 'top',
  background: 'rgba(0, 0, 0, 0.05)',
  border: `1px solid ${theme.color.border}`,
  borderRadius: 3,
}));
const CaughtExceptionTitle = styled.div({
  paddingBottom: 4,
  fontWeight: 'bold',
});
const CaughtExceptionDescription = styled.p({
  margin: 0,
  padding: '0 0 20px',
});
const CaughtExceptionStack = styled.pre(({ theme }) => ({
  margin: 0,
  padding: 0,
  fontSize: theme.typography.size.s1 - 1,
}));

export const AddonPanelPure: React.FC<InteractionsPanelProps> = React.memo(
  ({
    calls,
    controls,
    controlStates,
    interactions,
    fileName,
    hasException,
    caughtException,
    isPlaying,
    pausedAt,
    onScrollToEnd,
    endRef,
    isRerunAnimating,
    setIsRerunAnimating,
    ...panelProps
  }) => (
    <AddonPanel {...panelProps}>
      <Container hasException={hasException}>
        {controlStates.debugger && (interactions.length > 0 || hasException) && (
          <Subnav
            controls={controls}
            controlStates={controlStates}
            status={
              // eslint-disable-next-line no-nested-ternary
              isPlaying ? CallStates.ACTIVE : hasException ? CallStates.ERROR : CallStates.DONE
            }
            storyFileName={fileName}
            onScrollToEnd={onScrollToEnd}
            isRerunAnimating={isRerunAnimating}
            setIsRerunAnimating={setIsRerunAnimating}
          />
        )}
        <div>
          {interactions.map((call) => (
            <Interaction
              key={call.id}
              call={call}
              callsById={calls}
              controls={controls}
              controlStates={controlStates}
              childCallIds={call.childCallIds}
              isCollapsed={call.isCollapsed}
              toggleCollapsed={call.toggleCollapsed}
              pausedAt={pausedAt}
            />
          ))}
        </div>
        {caughtException?.message && !caughtException?.message.startsWith('ignoredException') && (
          <CaughtException>
            <CaughtExceptionTitle>
              Caught exception in <CaughtExceptionCode>play</CaughtExceptionCode> function
            </CaughtExceptionTitle>
            <CaughtExceptionDescription>
              This story threw an error after it finished rendering which means your interactions
              couldn&apos;t be run. Go to this story&apos;s play function in {fileName} to fix.
            </CaughtExceptionDescription>
            <CaughtExceptionStack>{caughtException.stack}</CaughtExceptionStack>
          </CaughtException>
        )}
        <div ref={endRef} />
        {!isPlaying && !caughtException && interactions.length === 0 && (
          <Placeholder>
            No interactions found
            <Link
              href="https://storybook.js.org/docs/react/writing-stories/play-function"
              target="_blank"
              withArrow
            >
              Learn how to add interactions to your story
            </Link>
          </Placeholder>
        )}
      </Container>
    </AddonPanel>
  )
);

export const Panel: React.FC<AddonPanelProps> = (props) => {
  const [storyId, setStoryId] = React.useState<StoryId>();
  const [controlStates, setControlStates] = React.useState<ControlStates>(INITIAL_CONTROL_STATES);
  const [pausedAt, setPausedAt] = React.useState<Call['id']>();
  const [isPlaying, setPlaying] = React.useState(false);
  const [isRerunAnimating, setIsRerunAnimating] = React.useState(false);
  const [scrollTarget, setScrollTarget] = React.useState<HTMLElement>();
  const [collapsed, setCollapsed] = React.useState<Set<Call['id']>>(new Set());
  const [caughtException, setCaughtException] = React.useState<Error>();
  const [log, setLog] = React.useState<LogItem[]>([]);

  // Calls are tracked in a ref so we don't needlessly rerender.
  const calls = React.useRef<Map<Call['id'], Omit<Call, 'status'>>>(new Map());
  const setCall = ({ status, ...call }: Call) => calls.current.set(call.id, call);

  const endRef = React.useRef();
  React.useEffect(() => {
    let observer: IntersectionObserver;
    if (global.window.IntersectionObserver) {
      observer = new global.window.IntersectionObserver(
        ([end]: any) => setScrollTarget(end.isIntersecting ? undefined : end.target),
        { root: global.window.document.querySelector('#panel-tab-content') }
      );
      if (endRef.current) observer.observe(endRef.current);
    }
    return () => observer?.disconnect();
  }, []);

  const emit = useChannel(
    {
      [EVENTS.CALL]: setCall,
      [EVENTS.SYNC]: (payload) => {
        setControlStates(payload.controlStates);
        setLog(payload.logItems);
        setPausedAt(payload.pausedAt);
      },
      [STORY_RENDER_PHASE_CHANGED]: (event) => {
        setStoryId(event.storyId);
        setPlaying(event.newPhase === 'playing');
        setPausedAt(undefined);
        if (event.newPhase === 'rendering') setCaughtException(undefined);
      },
      [STORY_THREW_EXCEPTION]: setCaughtException,
    },
    []
  );

  const controls = React.useMemo(
    () => ({
      start: () => emit(EVENTS.START, { storyId }),
      back: () => emit(EVENTS.BACK, { storyId }),
      goto: (callId: string) => emit(EVENTS.GOTO, { storyId, callId }),
      next: () => emit(EVENTS.NEXT, { storyId }),
      end: () => emit(EVENTS.END, { storyId }),
      rerun: () => {
        setIsRerunAnimating(true);
        emit(FORCE_REMOUNT, { storyId });
      },
    }),
    [storyId]
  );

  const storyFilePath = useParameter('fileName', '');
  const [fileName] = storyFilePath.toString().split('/').slice(-1);
  const scrollToTarget = () => scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'end' });

  const showStatus = (log.length > 0 || !!caughtException) && !isPlaying;
  const hasException = !!caughtException || log.some((item) => item.status === CallStates.ERROR);

  const interactions = React.useMemo(() => {
    const callsById = new Map<Call['id'], Call>();
    const childCallMap = new Map<Call['id'], Call['id'][]>();
    return log
      .filter(({ callId, parentId }) => {
        if (!parentId) return true;
        childCallMap.set(parentId, (childCallMap.get(parentId) || []).concat(callId));
        return !collapsed.has(parentId);
      })
      .map(({ callId, status }) => ({ ...calls.current.get(callId), status } as Call))
      .map((call) => {
        const status =
          call.status === CallStates.ERROR &&
          callsById.get(call.parentId)?.status === CallStates.ACTIVE
            ? CallStates.ACTIVE
            : call.status;
        callsById.set(call.id, { ...call, status });
        return {
          ...call,
          status,
          childCallIds: childCallMap.get(call.id),
          isCollapsed: collapsed.has(call.id),
          toggleCollapsed: () =>
            setCollapsed((ids) => {
              if (ids.has(call.id)) ids.delete(call.id);
              else ids.add(call.id);
              return new Set(ids);
            }),
        };
      });
  }, [log, collapsed]);

  return (
    <React.Fragment key="interactions">
      <TabStatus>
        {showStatus &&
          (hasException ? <TabIcon status={CallStates.ERROR} /> : ` (${interactions.length})`)}
      </TabStatus>
      <AddonPanelPure
        calls={calls.current}
        controls={controls}
        controlStates={controlStates}
        interactions={interactions}
        fileName={fileName}
        hasException={hasException}
        caughtException={caughtException}
        isPlaying={isPlaying}
        pausedAt={pausedAt}
        endRef={endRef}
        onScrollToEnd={scrollTarget && scrollToTarget}
        isRerunAnimating={isRerunAnimating}
        setIsRerunAnimating={setIsRerunAnimating}
        {...props}
      />
    </React.Fragment>
  );
};
