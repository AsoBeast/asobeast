import { Globe, Link2 } from "lucide-react";
import type { PortfolioApp, PortfolioGroup } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TrendChip } from "@/components/ui/delta-chip";
import { PortfolioGroupMember } from "./PortfolioAppCard";
import { orderMembers, type GroupVariant } from "./portfolio-rows";
import { Sparkline } from "./Sparkline";

function GroupVisibility({ group }: { group: PortfolioGroup | undefined }) {
  if (!group) {
    return (
      <span className="numeric font-mono text-3xl font-semibold text-muted-foreground">
        —
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="numeric font-mono text-3xl font-semibold">
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
}: {
  name: string;
  members: PortfolioApp[];
  variant: GroupVariant;
  group: PortfolioGroup | undefined;
}) {
  const storefront = variant === "storefront";
  const Icon = storefront ? Globe : Link2;

  return (
    <Card className="gap-0 p-4">
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span title={name} className="truncate font-medium">
            {name}
          </span>
          <Badge variant="outline" className="ml-auto">
            {storefront ? "Storefronts" : "Linked"}
          </Badge>
        </div>
        {storefront ? (
          <p className="text-caption text-muted-foreground">
            One listing across storefronts. Ranks are per market, so each row
            keeps its own score.
          </p>
        ) : (
          <GroupVisibility group={group} />
        )}
      </div>
      <ul className="flex flex-col divide-y">
        {orderMembers(members).map((member) => (
          <li key={member.id}>
            <PortfolioGroupMember app={member} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
