export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)

export const confidenceLabel = (confidence: number) => {
  if (confidence >= 78) return 'High confidence'
  if (confidence >= 60) return 'Moderate confidence'
  return 'Limited confidence'
}
