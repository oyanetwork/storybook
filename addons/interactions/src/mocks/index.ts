import { CallStates, Call } from '@storybook/instrumenter';

export const getCalls = (finalStatus: CallStates) => {
  const calls: Call[] = [
    {
      id: 'story--id [3] within',
      storyId: 'story--id',
      cursor: 3,
      path: [],
      method: 'within',
      args: [{ __element__: { localName: 'div', id: 'root' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [4] findByText',
      storyId: 'story--id',
      cursor: 4,
      path: [{ __callId__: 'story--id [3] within' }],
      method: 'findByText',
      args: ['Click'],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [5] click',
      storyId: 'story--id',
      cursor: 5,
      path: ['userEvent'],
      method: 'click',
      args: [{ __element__: { localName: 'button', innerText: 'Click' } }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor',
      storyId: 'story--id',
      cursor: 6,
      path: [],
      method: 'waitFor',
      args: [{ __function__: { name: '' } }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor [0] expect',
      parentId: 'story--id [6] waitFor',
      storyId: 'story--id',
      cursor: 1,
      path: [],
      method: 'expect',
      args: [{ __function__: { name: 'handleSubmit' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor [1] stringMatching',
      parentId: 'story--id [6] waitFor',
      storyId: 'story--id',
      cursor: 2,
      path: ['expect'],
      method: 'stringMatching',
      args: [{ __regexp__: { flags: 'gi', source: '([A-Z])w+' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
      parentId: 'story--id [6] waitFor',
      storyId: 'story--id',
      cursor: 3,
      path: [{ __callId__: 'story--id [6] waitFor [0] expect' }],
      method: 'toHaveBeenCalledWith',
      args: [{ __callId__: 'story--id [6] waitFor [1] stringMatching', retain: false }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [7] expect',
      storyId: 'story--id',
      cursor: 7,
      path: [],
      method: 'expect',
      args: [{ __function__: { name: 'handleReset' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [8] toHaveBeenCalled',
      storyId: 'story--id',
      cursor: 8,
      path: [{ __callId__: 'story--id [7] expect' }, 'not'],
      method: 'toHaveBeenCalled',
      args: [],
      interceptable: true,
      retain: false,
      status: finalStatus,
    },
  ];

  if (finalStatus === CallStates.ERROR) {
    calls[calls.length - 1].exception = {
      name: 'Error',
      stack: '',
      message: 'Oops!',
      callId: calls[calls.length - 1].id,
    };
  }

  return calls;
};

export const getInteractions = (finalStatus: CallStates) =>
  getCalls(finalStatus).filter((call) => call.interceptable);
