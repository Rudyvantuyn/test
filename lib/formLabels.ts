import { t, type Locale } from "./i18n";
import type { Labels } from "@/app/components/WatchForm";

export function formLabels(locale: Locale): Labels {
  const d = t(locale);
  return {
    product: d.inputProduct, email: d.inputEmail, target: d.inputTarget, submit: d.submit, busy: d.busy, free: d.free,
    success: d.success("{title}", "{price}").replace(" ({price})", "{price}"),
    delivery: d.watchOpts.delivery, anyShop: d.watchOpts.anyShop, condition: d.watchOpts.condition, any: d.watchOpts.any,
    d0: d.filters.deliveryToday, d1: d.filters.deliveryTomorrow, d3: d.filters.delivery3, d7: d.filters.delivery7,
  };
}
