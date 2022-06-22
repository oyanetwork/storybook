const componentParameter = 'componentParameter';
const storyParameter = 'storyParameter';

export default {
  title: 'Core/Parameters',
  parameters: {
    componentParameter,
  },
};

export const PassedToStory = (_args, { parameters: { fileName, ...parameters } }) => ({
  template: `<div>Parameters are <pre>${JSON.stringify(parameters, null, 2)}</pre></div>`,
});

PassedToStory.storyName = 'passed to story';

PassedToStory.parameters = {
  storyParameter,
};
