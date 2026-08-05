export function getComboMultiplier(winCount: number): 1 | 2 | 4 {
  if (winCount >= 3) return 4;
  if (winCount === 2) return 2;
  return 1;
}
