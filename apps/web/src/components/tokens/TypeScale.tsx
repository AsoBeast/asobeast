const STEPS = [
  {
    name: "display",
    sample: "Search visibility over time",
    className: "text-display",
  },
  { name: "title", sample: "Tracked keywords", className: "text-title" },
  {
    name: "subtitle",
    sample: "Where your keywords rank",
    className: "text-subtitle",
  },
  {
    name: "body",
    sample: "The phrases you want this app to rank for, tracked per market.",
    className: "text-body",
  },
  { name: "label", sample: "OPPORTUNITY", className: "text-label uppercase" },
  {
    name: "caption",
    sample: "Checked 3 days ago · depth 200",
    className: "text-caption",
  },
  {
    name: "numeric",
    sample: "1,234,567",
    className: "text-numeric numeric font-mono",
  },
] as const;

const RANKS = [
  { keyword: "focus timer", position: "3", traffic: "5,000", score: "82" },
  { keyword: "pomodoro", position: "12", traffic: "9,000", score: "60" },
  {
    keyword: "productivity app",
    position: ">200",
    traffic: "8,000",
    score: "70",
  },
  { keyword: "time blocking", position: "45", traffic: "—", score: "—" },
];

export function TypeScale() {
  return (
    <section aria-label="Type scale" className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold">Type scale</h2>

      <div className="flex flex-col gap-4">
        {STEPS.map((step) => (
          <div key={step.name} className="flex flex-col gap-1">
            <code className="text-[11px] text-muted-foreground">
              text-{step.name}
            </code>
            <span className={step.className}>{step.sample}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <code className="text-[11px] text-muted-foreground">
          columns align on tabular figures
        </code>
        <div className="overflow-x-auto">
          <table className="w-full max-w-lg text-sm">
            <caption className="sr-only">
              A rank column, a volume column and a score column rendered with
              the numeric treatment.
            </caption>
            <thead>
              <tr className="border-b text-left text-label text-muted-foreground uppercase">
                <th scope="col" className="py-1.5 font-medium">
                  Keyword
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Position
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Traffic
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {RANKS.map((row) => (
                <tr key={row.keyword}>
                  <td className="py-1.5">{row.keyword}</td>
                  <td className="numeric font-mono py-1.5 text-right">
                    {row.position}
                  </td>
                  <td className="numeric font-mono py-1.5 text-right">
                    {row.traffic}
                  </td>
                  <td className="numeric font-mono py-1.5 text-right">
                    {row.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <code className="text-[11px] text-muted-foreground">
          a long app name truncating beside a fixed control
        </code>
        <div className="flex max-w-md items-center gap-3 rounded-lg border p-3">
          <div className="size-8 shrink-0 rounded bg-secondary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            Deep Focus Pomodoro Timer and Habit Builder for Students and Remote
            Teams Pro
          </span>
          <span className="numeric font-mono shrink-0 text-sm text-signal-up">
            +12
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <code className="text-[11px] text-muted-foreground">
          review prose wrapping
        </code>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          Love the focus timer, but the widget stopped refreshing after the last
          update and I had to reinstall. Please add a way to pause a session
          without losing the streak — otherwise this is the best timer I have
          used.
        </p>
      </div>
    </section>
  );
}
