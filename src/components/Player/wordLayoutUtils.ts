import { estimateWordWidth } from '../../utils';

export interface ChallengeToken {
  id: string;
  text: string;
  isBlank: boolean;
  blankIndex: number;
  expectedWord?: string;
  lineIndex: number;
}

export interface JumbledWordItem {
  id: string;
  word: string;
  x: number;
  y: number;
}

export interface PlacedBlankItem {
  id: string;
  word: string;
}

export interface WebxdcPlayerStat {
  totalPlayed: number;
  totalWon: number;
  myStatus?: 'won' | 'surrendered' | 'failed';
  myErrors?: number;
}

// Distribute jumbled words across the pool without overlapping
export const distributeJumbledWords = (items: { id: string; word: string }[]): JumbledWordItem[] => {
  const n = items.length;
  if (n === 0) return [];

  const shuffled = [...items].sort(() => Math.random() - 0.5);

  let rowCounts: number[] = [];
  if (n <= 3) {
    rowCounts = [n];
  } else if (n <= 6) {
    const top = Math.ceil(n / 2);
    rowCounts = [top, n - top];
  } else {
    const r1 = Math.ceil(n / 3);
    const r2 = Math.ceil((n - r1) / 2);
    const r3 = n - r1 - r2;
    rowCounts = [r1, r2, r3];
  }

  const ySlots = rowCounts.length === 1 
    ? [0] 
    : rowCounts.length === 2 
      ? [-22, 22] 
      : [-38, 0, 38];

  const positions: { id: string; word: string; x: number; y: number; w: number; h: number }[] = [];
  let itemIdx = 0;

  for (let r = 0; r < rowCounts.length; r++) {
    const countInRow = rowCounts[r];
    const yBase = ySlots[r];
    const rowItems = shuffled.slice(itemIdx, itemIdx + countInRow);
    const totalEstWidth = rowItems.reduce((acc, it) => acc + estimateWordWidth(it.word), 0);
    const spacing = countInRow > 1 ? Math.min(20, (290 - totalEstWidth) / (countInRow - 1)) : 0;
    
    const span = totalEstWidth + Math.max(0, countInRow - 1) * Math.max(6, spacing);
    let currentX = -span / 2;

    for (let c = 0; c < countInRow; c++) {
      const it = rowItems[c];
      const w = estimateWordWidth(it.word);
      const centerX = currentX + w / 2;
      currentX += w + Math.max(6, spacing);
      positions.push({
        id: it.id,
        word: it.word,
        x: Math.round(centerX),
        y: Math.round(yBase),
        w,
        h: 36
      });
    }
    itemIdx += countInRow;
  }

  // Relaxation pass to prevent overlapping bounding boxes
  for (let iter = 0; iter < 25; iter++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i];
        const p2 = positions[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const reqX = (p1.w + p2.w) / 2 + 6;
        const reqY = (p1.h + p2.h) / 2 + 6;

        if (Math.abs(dx) < reqX && Math.abs(dy) < reqY) {
          const overlapX = reqX - Math.abs(dx);
          const overlapY = reqY - Math.abs(dy);

          if (overlapX < overlapY) {
            const shift = overlapX / 2;
            const sign = dx >= 0 ? 1 : -1;
            p1.x -= sign * shift;
            p2.x += sign * shift;
          } else {
            const shift = overlapY / 2;
            const sign = dy >= 0 ? 1 : -1;
            p1.y -= sign * shift;
            p2.y += sign * shift;
          }
        }
      }
    }
    for (const p of positions) {
      p.x = Math.max(-140, Math.min(140, p.x));
      p.y = Math.max(-42, Math.min(42, p.y));
    }
  }

  return positions.map(p => ({
    id: p.id,
    word: p.word,
    x: Math.round(p.x),
    y: Math.round(p.y)
  }));
};
