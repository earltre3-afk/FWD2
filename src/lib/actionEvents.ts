import type React from 'react';

export function stopActionEvent(event?: React.MouseEvent<HTMLElement> | MouseEvent): void {
  event?.preventDefault();
  event?.stopPropagation();
}
