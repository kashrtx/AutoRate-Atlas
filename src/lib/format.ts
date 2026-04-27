export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)

/** Currency label for display — all values are in USD */
export const CURRENCY_LABEL = 'USD'

export const confidenceLabel = (confidence: number) => {
  if (confidence >= 78) return 'High confidence'
  if (confidence >= 60) return 'Moderate confidence'
  return 'Limited confidence'
}
