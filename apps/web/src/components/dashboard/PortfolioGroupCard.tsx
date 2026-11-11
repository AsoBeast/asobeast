import type {
  PortfolioApp,
  PortfolioAppInsight,
  PortfolioGroup,
} from "@asobeast/shared";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import { PortfolioGroupMember } from "./PortfolioAppCard";
import { orderMembers, type GroupVariant } from "./portfolio-rows";
import { Sparkline } from "./Sparkline";

function GroupVisibility({ group }: { group: PortfolioGroup | undefined }) {
  if (!group) {
    return <span className="numeric text-metric text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="numeric text-metric">
          {Math.round(group.visibility.current)}
        </span>
        <span className="text-caption text-muted-foreground">
          blended visibility
        </span>
      </div>
      <TrendChip label="7d" value={group.visibility.delta7d} />
      <p className="text-caption text-muted-foreground">
        Blended across stores, whose scores are not directly comparable.
      </p>
      <Sparkline points={group.sparkline} />
    </div>
  );
}

export function PortfolioGroupCard({
  name,
  members,
  variant,
  group,
  insightFor,
}: {
  name: string;
  members: PortfolioApp[];
  variant: GroupVariant;
  group: PortfolioGroup | undefined;
  insightFor: (appId: string) => PortfolioAppInsight | undefined;
}) {
  const storefront = variant === "storefront";

  return (
    <Card className="h-full gap-0 p-4">
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <span title={name} className="truncate font-medium">
            {name}
          </span>
          <span className="ml-auto shrink-0 text-label text-faint-foreground">
            {storefront ? "Storefronts" : "Linked"}
          </span>
        </div>
        {storefront ? null : <GroupVisibility group={group} />}
      </div>
      <ul className="flex flex-col divide-y">
        {orderMembers(members).map((member) => (
          <li key={member.id}>
            <PortfolioGroupMember
              app={member}
              insight={insightFor(member.id)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
