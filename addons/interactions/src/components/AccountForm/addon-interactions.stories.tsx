/* eslint-disable jest/no-standalone-expect */
import { Story as CSF2Story, Meta, ComponentStoryObj } from '@storybook/react';
import { expect } from '@storybook/jest';
import {
  within,
  waitFor,
  fireEvent,
  userEvent,
  waitForElementToBeRemoved,
} from '@storybook/testing-library';
import React from 'react';

import { AccountForm } from './AccountForm';

export default {
  title: 'Addons/Interactions/AccountForm',
  component: AccountForm,
  parameters: {
    layout: 'centered',
    theme: 'light',
    options: { selectedPanel: 'storybook/interactions/panel' },
  },
  argTypes: {
    onSubmit: { action: true },
  },
} as Meta;

type CSF3Story = ComponentStoryObj<typeof AccountForm>;

export const Demo: CSF2Story = (args) => (
  <button type="button" onClick={() => args.onSubmit('clicked')}>
    Click
  </button>
);

Demo.play = async ({ args, canvasElement }) => {
  await userEvent.click(within(canvasElement).getByRole('button'));
  await expect(args.onSubmit).toHaveBeenCalledWith(expect.stringMatching(/([A-Z])\w+/gi));
  await expect([{ name: 'John', age: 42 }]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'John' }),
      expect.objectContaining({ age: 42 }),
    ])
  );
};

export const FindBy: CSF2Story = (args) => {
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

export const WaitFor: CSF2Story = (args) => (
  <button type="button" onClick={() => setTimeout(() => args.onSubmit('clicked'), 100)}>
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

export const WaitForElementToBeRemoved: CSF2Story = () => {
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

export const WithLoaders: CSF2Story = (args, { loaded: { todo } }) => {
  return (
    <button type="button" onClick={args.onSubmit(todo.title)}>
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

export const Standard: CSF3Story = {
  args: { passwordVerification: false },
};

export const StandardEmailFilled = {
  ...Standard,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email', async () => {
      await fireEvent.change(canvas.getByTestId('email'), {
        target: { value: 'michael@chromatic.com' },
      });
    });
  },
};

export const StandardEmailFailed = {
  ...Standard,
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'gert@chromatic');
      await userEvent.type(canvas.getByTestId('password1'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /create account/i }));
    });

    await canvas.findByText('Please enter a correctly formatted email address');
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const StandardEmailSuccess = {
  ...Standard,
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'michael@chromatic.com');
      await userEvent.type(canvas.getByTestId('password1'), 'testpasswordthatwontfail');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByTestId('submit'));
    });

    await waitFor(async () => {
      await expect(args.onSubmit).toHaveBeenCalledTimes(1);
      await expect(args.onSubmit).toHaveBeenCalledWith({
        email: 'michael@chromatic.com',
        password: 'testpasswordthatwontfail',
      });
    });
  },
};

export const StandardPasswordFailed = {
  ...Standard,
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await StandardEmailFilled.play(context);

    await context.step('Enter password', async () => {
      await userEvent.type(canvas.getByTestId('password1'), 'asdf');
    });

    await context.step('Submit form', async () => {
      await userEvent.click(canvas.getByTestId('submit'));
    });
  },
};

export const StandardFailHover = {
  ...StandardPasswordFailed,
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await StandardPasswordFailed.play(context);
    await waitFor(async () => {
      await userEvent.hover(canvas.getByTestId('password-error-info'));
    });
  },
};

export const Verification = {
  args: { passwordVerification: true },
  argTypes: { onSubmit: { action: 'clicked' } },
};

export const VerificationPassword = {
  ...Verification,
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await StandardEmailFilled.play(context);
    await context.step('Enter password', async () => {
      await userEvent.type(canvas.getByTestId('password1'), 'asdfasdf');
    });
    await context.step('Submit form', async () => {
      await userEvent.click(canvas.getByTestId('submit'));
    });
  },
};

export const VerificationPasswordMismatch = {
  ...Verification,
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await StandardEmailFilled.play(context);
    await context.step('Enter passwords', async () => {
      await userEvent.type(canvas.getByTestId('password1'), 'asdfasdf');
      await userEvent.type(canvas.getByTestId('password2'), 'asdf1234');
    });
    await context.step('Submit form', async () => {
      await userEvent.click(canvas.getByTestId('submit'));
    });
  },
};

export const VerificationSuccess = {
  ...Verification,
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await StandardEmailFilled.play(context);

    await context.step('Enter passwords', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await userEvent.type(canvas.getByTestId('password1'), 'helloyou', { delay: 50 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await userEvent.type(canvas.getByTestId('password2'), 'helloyou', { delay: 50 });
    });

    await context.step('Submit form', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await userEvent.click(canvas.getByTestId('submit'));
    });
  },
};
