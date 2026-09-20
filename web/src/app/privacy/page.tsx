export const metadata = { title: "Privacy · Pixie" };

export default function Privacy() {
  return (
    <main className="px-6 py-8 sm:px-10">
      <h1 className="font-serif text-[32px] font-semibold leading-tight">Demo data and privacy</h1>
      <div className="mt-3 max-w-[65ch] space-y-4 text-[13px] leading-relaxed">
        <p>Pixie is a Hack the North 2026 prototype. Its commercial underwriting book is Federato&apos;s synthetic dataset. Renter quotes store the address, answers and computed receipt so the desk can open the same case. Enter sample information when trying the demo.</p>
        <p>Enabled services may process location queries, underwriting prompts and diagnostic events when their corresponding tools run.</p>
        <p>Addresses may be geocoded through OpenStreetMap&apos;s Nominatim. Map tiles come from OpenFreeMap. Diagnostic reporting uses Sentry. Some external results are cached locally so the demonstration can be repeated.</p>
        <p>The demo has no customer account or self-service data deletion system. Ask the presenter before entering personal information or sending a message. The reset buttons restore demonstration decisions and actions; they do not erase provider records or recall messages already sent.</p>
      </div>
    </main>
  );
}
