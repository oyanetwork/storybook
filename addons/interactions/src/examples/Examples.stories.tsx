/* eslint-disable jest/no-standalone-expect */
import { Story, Meta } from '@storybook/react';
import { expect } from '@storybook/jest';
import { within, waitFor, userEvent, waitForElementToBeRemoved } from '@storybook/testing-library';
import React from 'react';

export default {
  title: 'Addons/Interactions/Examples',
  parameters: {
    layout: 'centered',
    theme: 'light',
    options: { selectedPanel: 'storybook/interactions/panel' },
  },
  argTypes: {
    onSubmit: { action: true },
  },
} as Meta;

export const Assertions: Story = ({ onSubmit }) => (
  <button type="button" onClick={() => onSubmit('clicked')}>
    Click
  </button>
);
Assertions.play = async ({ args, canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button'));
  await expect(args.onSubmit).toHaveBeenCalledWith(expect.stringMatching(/([A-Z])\w+/gi));
  await expect([{ name: 'John', age: 42 }]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'John' }),
      expect.objectContaining({ age: 42 }),
    ])
  );
};

export const FindBy: Story = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  React.useEffect(() => {
    setTimeout(() => setIsLoading(false), 500);
  }, []);
  return isLoading ? <div>Loading...</div> : <button type="button">Loaded!</button>;
};
FindBy.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await canvas.findByRole('button');
  await expect(true).toBe(true);
};

export const WaitFor: Story = ({ onSubmit }) => (
  <button type="button" onClick={() => setTimeout(() => onSubmit('clicked'), 100)}>
    Click
  </button>
);
WaitFor.play = async ({ args, canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByText('Click'));
  await waitFor(async () => {
    await expect(args.onSubmit).toHaveBeenCalledWith(expect.stringMatching(/([A-Z])\w+/gi));
    await expect(true).toBe(true);
  });
};

export const WaitForElementToBeRemoved: Story = () => {
  const [isLoading, setIsLoading] = React.useState(true);
  React.useEffect(() => {
    setTimeout(() => setIsLoading(false), 1500);
  }, []);
  return isLoading ? <div>Loading...</div> : <button type="button">Loaded!</button>;
};
WaitForElementToBeRemoved.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await waitForElementToBeRemoved(await canvas.findByText('Loading...'), { timeout: 2000 });
  const button = await canvas.findByText('Loaded!');
  await expect(button).not.toBeNull();
};

export const WithLoaders: Story = ({ onSubmit }, { loaded: { todo } }) => {
  return (
    <button type="button" onClick={onSubmit(todo.title)}>
      Todo: {todo.title}
    </button>
  );
};
WithLoaders.loaders = [
  async () => {
    // long fake timeout
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      todo: {
        userId: 1,
        id: 1,
        title: 'delectus aut autem',
        completed: false,
      },
    };
  },
];
WithLoaders.play = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement);
  const todoItem = await canvas.findByText('Todo: delectus aut autem');
  await userEvent.click(todoItem);
  await expect(args.onSubmit).toHaveBeenCalledWith('delectus aut autem');
};

export const WithSteps: Story = ({ onSubmit }) => (
  <button type="button" onClick={() => onSubmit('clicked')}>
    Click
  </button>
);
WithSteps.play = async ({ args, canvasElement, step }) => {
  step('Click button', async () => {
    await userEvent.click(within(canvasElement).getByRole('button'));

    step('Verify submit', async () => {
      await expect(args.onSubmit).toHaveBeenCalledWith(expect.stringMatching(/([A-Z])\w+/gi));
    });

    step('Verify result', async () => {
      await expect([{ name: 'John', age: 42 }]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'John' }),
          expect.objectContaining({ age: 42 }),
        ])
      );
    });
  });
};
