/* eslint-disable jest/no-standalone-expect */
import React from 'react';
import { action } from '@storybook/addon-actions';
import { ComponentStoryObj, ComponentMeta } from '@storybook/react';
import { CallStates } from '@storybook/instrumenter';
import { styled } from '@storybook/theming';
import { userEvent, within, waitFor } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

import { getCalls, getInteractions } from '../mocks';
import { InteractionsPanel } from './InteractionsPanel';
import SubnavStories from './Subnav.stories';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  color: theme.color.defaultText,
  display: 'block',
  height: '100%',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'auto',
}));

const interactions = getInteractions(CallStates.DONE);

export default {
  title: 'Addons/Interactions/Panel',
  component: InteractionsPanel,
  decorators: [
    (Story: any) => (
      <StyledWrapper id="panel-tab-content">
        <Story />
      </StyledWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    calls: new Map(getCalls(CallStates.DONE).map((call) => [call.id, call])),
    controls: SubnavStories.args.controls,
    controlStates: SubnavStories.args.controlStates,
    interactions,
    fileName: 'addon-interactions.stories.tsx',
    hasException: false,
    isPlaying: false,
    onScrollToEnd: action('onScrollToEnd'),
    endRef: null,
    // prop for the AddonPanel used as wrapper of Panel
    active: true,
  },
} as ComponentMeta<typeof InteractionsPanel>;

type Story = ComponentStoryObj<typeof InteractionsPanel>;

export const Passing: Story = {
  args: {
    interactions: getInteractions(CallStates.DONE),
  },
};
Passing.play = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement);

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go to start'));
    await expect(args.controls.start).toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go back'));
    await expect(args.controls.back).toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go forward'));
    await expect(args.controls.next).not.toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Go to end'));
    await expect(args.controls.end).not.toHaveBeenCalled();
  });

  await waitFor(async () => {
    await userEvent.click(canvas.getByLabelText('Rerun'));
    await expect(args.controls.rerun).toHaveBeenCalled();
  });
};

export const Paused: Story = {
  args: {
    isPlaying: true,
    interactions: getInteractions(CallStates.WAITING),
    controlStates: {
      debugger: true,
      start: false,
      back: false,
      goto: true,
      next: true,
      end: true,
    },
    pausedAt: interactions[interactions.length - 1].id,
  },
};

export const Playing: Story = {
  args: {
    isPlaying: true,
    interactions: getInteractions(CallStates.ACTIVE),
  },
};

export const Failed: Story = {
  args: {
    hasException: true,
    interactions: getInteractions(CallStates.ERROR),
  },
};

export const WithDebuggingDisabled: Story = {
  args: { controlStates: { ...SubnavStories.args.controlStates, debugger: false } },
};

export const NoInteractions: Story = {
  args: {
    interactions: [],
  },
};

export const CaughtException: Story = {
  args: {
    hasException: true,
    interactions: [],
    caughtException: new TypeError("Cannot read properties of undefined (reading 'args')"),
  },
};
