
export type LetterData = {
  char: string;
  path: string; // Simplified SVG path representation or drawing instructions
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  alpha: number;
};

export enum GameState {
  IDLE = 'IDLE',
  READY = 'READY',
  TRACING = 'TRACING',
  CELEBRATING = 'CELEBRATING',
}
