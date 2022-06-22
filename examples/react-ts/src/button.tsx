import React, { ComponentType, ButtonHTMLAttributes, useEffect } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * A label to show on the button
   */
  label: string;

  /**
   * An icon to show on the left of the label
   */
  icon?: ComponentType;
}

export const Button = ({ label = 'Hello', icon: Icon, ...props }: ButtonProps) => {
  useEffect(() => {
    const fn = () => console.log(`click ${label}`);
    global.window.document.querySelector('body')?.addEventListener('click', fn);
    return () => global.window.document.querySelector('body')?.removeEventListener('click', fn);
  });
  return (
    <button type="button" {...props}>
      {Icon ? <Icon /> : null} {label}
    </button>
  );
};
