export function getSignificanceColor(score: number): string {
  if (score >= 7) return "text-significance-high";
  if (score >= 4) return "text-significance-medium";
  return "text-significance-low";
}

export function getSignificanceBgColor(score: number): string {
  if (score >= 7) return "bg-significance-high/10 text-significance-high";
  if (score >= 4) return "bg-significance-medium/10 text-significance-medium";
  return "bg-significance-low/10 text-significance-low";
}

export function getSignificanceLabel(score: number): string {
  if (score >= 9) return "Critical";
  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

export function getSignificanceDotColor(score: number): string {
  if (score >= 7) return "bg-significance-high";
  if (score >= 4) return "bg-significance-medium";
  return "bg-significance-low";
}
