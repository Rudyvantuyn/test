import type { ProductRow } from "@/lib/supabase";

/** schema.org Product + AggregateOffer zodat Google prijs en aanbieders toont in de zoekresultaten. */
export default function ProductJsonLd({ p, offers, url }: { p: ProductRow; offers: ProductRow[]; url: string }) {
  const priced = offers.filter((o) => o.last_price !== null && o.in_stock);
  const prices = priced.map((o) => Number(o.last_price));
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    image: p.image_url ?? undefined,
    ...(p.ean ? { gtin13: p.ean } : {}),
    url,
    offers: priced.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: p.currency,
          lowPrice: Math.min(...prices).toFixed(2),
          highPrice: Math.max(...prices).toFixed(2),
          offerCount: priced.length,
          offers: priced.map((o) => offer(o)),
        }
      : offer(p),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

function offer(o: ProductRow) {
  return {
    "@type": "Offer",
    price: o.last_price !== null ? Number(o.last_price).toFixed(2) : undefined,
    priceCurrency: o.currency,
    availability: o.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: o.condition === "used" ? "https://schema.org/UsedCondition" : o.condition === "refurbished" ? "https://schema.org/RefurbishedCondition" : "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: o.merchant ?? o.retailer },
    ...(o.shipping_cost !== null ? { shippingDetails: { "@type": "OfferShippingDetails", shippingRate: { "@type": "MonetaryAmount", value: Number(o.shipping_cost).toFixed(2), currency: o.currency } } } : {}),
  };
}
