import type { PriceVn, PurchaseChannel } from '../../catalog/shared/catalog-shared-price-and-provenance-schema'
import { formatVnd } from '../../domain/bom/bom-price-formatting'

interface IndicativePriceProps {
  testId: string
  priceVn: PriceVn | null
}

/**
 * The single indicative price shown for a record with no per-shop sales
 * channels - shared by the camera, sensor and fire-alarm catalog cards
 * (third copy triggered the extraction, CLAUDE.md "rule of three").
 */
export function IndicativePrice({ testId, priceVn }: IndicativePriceProps) {
  if (!priceVn) {
    return (
      <span className="text-neutral-400" title="No Vietnam reseller publishes a price for this model">
        price on request
      </span>
    )
  }
  return (
    <a
      data-testid={testId}
      href={priceVn.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Vietnam reseller price, checked ${priceVn.retrieved}`}
      className="font-semibold text-neutral-800 hover:underline"
    >
      ~{formatVnd(priceVn.amountVnd)}
    </a>
  )
}

interface PurchaseChannelRowProps {
  testId: string
  channel: PurchaseChannel
}

/** One sales channel: that shop's price and a "buy (shop)" link; the click never starts a card drag. */
export function PurchaseChannelRow({ testId, channel }: PurchaseChannelRowProps) {
  return (
    <div className="mt-1 flex items-baseline justify-between gap-2">
      <span
        className={channel.amountVnd ? 'font-semibold text-neutral-800' : 'text-neutral-400'}
        title={`${channel.shop} price, checked ${channel.retrieved}`}
      >
        {channel.amountVnd ? `~${formatVnd(channel.amountVnd)}` : 'price on request'}
      </span>
      <a
        data-testid={testId}
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-blue-600 hover:underline"
      >
        buy ({channel.shop})
      </a>
    </div>
  )
}
