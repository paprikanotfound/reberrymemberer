
export function mapRange(
    value: number,
    inMin: number,
    inMax: number,
    outMin: number,
    outMax: number
  ): number {
    if (inMin === inMax) {
      throw new Error('Input range cannot be zero');
    }

    return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
  }