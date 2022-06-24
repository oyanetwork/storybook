import * as React from 'react';
import { IconButton, Icons, TooltipNote, WithTooltip } from '@storybook/components';
import { Call, CallStates, ControlStates } from '@storybook/instrumenter';
import { styled, typography } from '@storybook/theming';
import { transparentize } from 'polished';

import { MatcherResult } from './MatcherResult';
import { MethodCall } from './MethodCall';
import { StatusIcon } from './StatusIcon';
import { Controls } from './InteractionsPanel';

const MethodCallWrapper = styled.div(() => ({
  fontFamily: typography.fonts.mono,
  fontSize: typography.size.s1,
  overflowWrap: 'break-word',
  inlineSize: 'calc( 100% - 40px )',
}));

const RowContainer = styled('div', {
  shouldForwardProp: (prop) => !['call', 'pausedAt'].includes(prop),
})<{ call: Call; pausedAt: Call['id'] }>(
  ({ theme, call }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    borderBottom: `1px solid ${theme.appBorderColor}`,
    fontFamily: typography.fonts.base,
    fontSize: 13,
    backgroundColor: theme.background.content,
    ...(call.status === CallStates.ERROR && {
      backgroundColor:
        theme.base === 'dark'
          ? transparentize(0.93, theme.color.negative)
          : theme.background.warning,
    }),
    paddingLeft: call.parentId ? 20 : 0,
  }),
  ({ theme, call, pausedAt }) =>
    pausedAt === call.id && {
      '&::before': {
        content: '""',
        position: 'absolute',
        top: -5,
        zIndex: 1,
        borderTop: '4.5px solid transparent',
        borderLeft: `7px solid ${theme.color.warning}`,
        borderBottom: '4.5px solid transparent',
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: -1,
        zIndex: 1,
        width: '100%',
        borderTop: `1.5px solid ${theme.color.warning}`,
      },
    }
);

const RowHeader = styled.div<{ disabled: boolean }>(({ theme, disabled }) => ({
  display: 'flex',
  '&:hover': disabled ? {} : { background: theme.background.hoverable },
}));

const RowLabel = styled('button', { shouldForwardProp: (prop) => !['call'].includes(prop) })<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { call: Call }
>(({ theme, disabled, call }) => ({
  flex: 1,
  display: 'grid',
  background: 'none',
  border: 0,
  gridTemplateColumns: '15px 1fr',
  alignItems: 'center',
  minHeight: 40,
  margin: 0,
  padding: '8px 15px',
  textAlign: 'start',
  cursor: disabled || call.status === CallStates.ERROR ? 'default' : 'pointer',
  '&:focus-visible': {
    outline: 0,
    boxShadow: `inset 3px 0 0 0 ${
      call.status === CallStates.ERROR ? theme.color.warning : theme.color.secondary
    }`,
    background: call.status === CallStates.ERROR ? 'transparent' : theme.background.hoverable,
  },
  '& > div': {
    opacity: call.status === CallStates.WAITING ? 0.5 : 1,
  },
}));

const RowActions = styled.div(({ theme }) => ({
  padding: 6,
}));

export const StyledIconButton = styled(IconButton as any)(({ theme }) => ({
  color: theme.color.mediumdark,
  margin: '0 3px',
}));

const Note = styled(TooltipNote)(({ theme }) => ({
  fontFamily: theme.typography.fonts.base,
}));

const RowMessage = styled('div')(({ theme }) => ({
  padding: '8px 10px 8px 36px',
  fontSize: typography.size.s1,
  pre: {
    margin: 0,
    padding: 0,
  },
  p: {
    color: theme.color.dark,
  },
}));

const Exception = ({ message }: { message: string }) => {
  if (message.startsWith('expect(')) {
    return <MatcherResult message={message} />;
  }
  const paragraphs = message.split('\n\n');
  const more = paragraphs.length > 1;
  return (
    <RowMessage>
      <pre>{paragraphs[0]}</pre>
      {more && <p>See the full stack trace in the browser console.</p>}
    </RowMessage>
  );
};

export const Interaction = ({
  call,
  callsById,
  controls,
  controlStates,
  childCallIds,
  isCollapsed,
  toggleCollapsed,
  pausedAt,
}: {
  call: Call;
  callsById: Map<Call['id'], Call>;
  controls: Controls;
  controlStates: ControlStates;
  childCallIds?: Call['id'][];
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  pausedAt?: Call['id'];
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  return (
    <RowContainer call={call} pausedAt={pausedAt}>
      <RowHeader disabled={!controlStates.goto || !call.interceptable || !!call.parentId}>
        <RowLabel
          call={call}
          onClick={() => controls.goto(call.id)}
          disabled={!controlStates.goto || !call.interceptable || !!call.parentId}
          onMouseEnter={() => controlStates.goto && setIsHovered(true)}
          onMouseLeave={() => controlStates.goto && setIsHovered(false)}
        >
          <StatusIcon status={isHovered ? CallStates.ACTIVE : call.status} />
          <MethodCallWrapper style={{ marginLeft: 6, marginBottom: 1 }}>
            <MethodCall call={call} callsById={callsById} />
          </MethodCallWrapper>
        </RowLabel>
        <RowActions>
          {childCallIds?.length > 0 && (
            <WithTooltip
              hasChrome={false}
              tooltip={
                <Note
                  note={`${isCollapsed ? 'Show' : 'Hide'} interactions (${childCallIds.length})`}
                />
              }
            >
              <StyledIconButton containsIcon onClick={toggleCollapsed}>
                <Icons icon="listunordered" />
              </StyledIconButton>
            </WithTooltip>
          )}
        </RowActions>
      </RowHeader>

      {call.status === CallStates.ERROR && call.exception?.callId === call.id && (
        <Exception {...call.exception} />
      )}
    </RowContainer>
  );
};
