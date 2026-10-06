// Types for model.js (m2cgen export of the Python-trained classifier).
// Input: 126 features from buildTwoHandFeatures. Output: one probability per class.
export function score(input: number[]): number[];
export const HAND_SIGN_CLASSES: string[];
