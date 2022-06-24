import global from 'global';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { useChannel, useParameter, StoryId } from '@storybook/api';
import {
  IGNORED_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  STORY_THREW_EXCEPTION,
  FORCE_REMOUNT,
} from '@storybook/core-events';
import { EVENTS, Call, CallStates, ControlStates, LogItem } from '@storybook/instrumenter';
import { styled } from '@storybook/theming';

import { StatusIcon } from './components/StatusIcon';
import { InteractionsPanel } from './components/InteractionsPanel';

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

export const Panel: React.FC<{ active: boolean }> = (props) => {
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
      [STORY_THREW_EXCEPTION]: (e) => {
        if (e?.message !== IGNORED_EXCEPTION.message) setCaughtException(e);
        else setCaughtException(undefined);
      },
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
      <InteractionsPanel
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
