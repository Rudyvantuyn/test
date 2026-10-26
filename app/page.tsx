import WatchForm from "./components/WatchForm";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <h1>Betaal nooit te veel bij bol.com</h1>
      <p className="lead">
        Plak een productlink, en wij mailen je zodra de prijs daalt. Zo koop je op het laagste moment.
      </p>
      <WatchForm />
      <h2>Hoe het werkt</h2>
      <ol>
        <li>Plak de link van een bol.com product en vul je e-mailadres in.</li>
        <li>Wij controleren de prijs meerdere keren per dag.</li>
        <li>Daalt de prijs? Dan krijg je direct een mail met de nieuwe prijs.</li>
      </ol>
      <p>
        Of bekijk de <Link href="/dalers">grootste prijsdalingen van vandaag</Link>.
      </p>
    </>
  );
}
