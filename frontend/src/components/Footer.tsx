export function Footer() {
  return (
    <footer className="mt-16 pb-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="divider" />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-500">
          <div>
            © University of Auckland · Research Contracts Adviser POC. Not
            legal advice.
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-flag-green" />
            All decisions remain with the Research Contracts team.
          </div>
        </div>
      </div>
    </footer>
  );
}
