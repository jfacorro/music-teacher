export const LoadStatus = {
  Loading: 'loading',
  Ready: 'ready',
  Error: 'error',
} as const;
export type LoadStatus = (typeof LoadStatus)[keyof typeof LoadStatus];
