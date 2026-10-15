export const StarsSize = {
  Large: 'large',
  Small: 'small',
} as const;
export type StarsSize = (typeof StarsSize)[keyof typeof StarsSize];
