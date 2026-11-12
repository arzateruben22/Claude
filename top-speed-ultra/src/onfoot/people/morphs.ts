// The face's morph targets, in the order every head mesh carries them. A leaf module (it imports nothing): face.ts
// builds the expressions' fields over them and skin.ts' shader reads the smile and squint weights at their indices, so
// neither has to import the other for them (face.ts takes the noise from skin.ts). face.ts re-exports them.
export const MORPHS = ['jawOpen', 'mouthClose', 'smileL', 'smileR', 'wide', 'pucker', 'press', 'tuck', 'browUp', 'browDownL', 'browDownR', 'blinkL', 'blinkR', 'squintL', 'squintR'] as const;
export type MorphName = typeof MORPHS[number];
export const MI: Record<MorphName, number> = Object.fromEntries(MORPHS.map((n, i) => [n, i])) as Record<MorphName, number>;
export const NM = MORPHS.length;
