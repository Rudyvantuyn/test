import { t, type Locale } from "./i18n";

export function formLabels(locale: Locale) {
  const d = t(locale);
  return {
    product: d.inputProduct,
    email: d.inputEmail,
    target: d.inputTarget,
    submit: d.submit,
    busy: d.busy,
    free: d.free,
    success: d.success("{title}", "{price}").replace(" ({price})", "{price}"),
  };
}
