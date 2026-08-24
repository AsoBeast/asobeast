"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DeltaChip, TrendChip } from "@/components/ui/delta-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "success",
  "warning",
  "info",
  "destructive",
  "ghost",
] as const;

function Row({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <code className="text-[11px] text-muted-foreground">{title}</code>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function PrimitiveGallery() {
  return (
    <section aria-label="Primitives" className="flex flex-col gap-6">
      <h2 className="text-sm font-semibold">Primitives</h2>

      <Row title="button variants">
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </Row>

      <Row title="button sizes">
        {BUTTON_SIZES.map((size) => (
          <Button key={size} size={size}>
            {size}
          </Button>
        ))}
      </Row>

      <Row title="button states">
        <Button disabled>disabled</Button>
        <Button variant="outline" disabled>
          disabled outline
        </Button>
        <Button aria-invalid>invalid</Button>
      </Row>

      <Row title="badge variants">
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant}>
            {variant}
          </Badge>
        ))}
      </Row>

      <Row title="delta chips">
        <DeltaChip value={-7} period="over 7 days" />
        <DeltaChip value={6} period="over 7 days" />
        <DeltaChip value={0} period="over 7 days" />
        <DeltaChip value={null} period="over 7 days" />
        <TrendChip label="7d" value={5} />
        <TrendChip label="30d" value={-3} />
        <TrendChip label="7d" value={0} />
      </Row>

      <Row title="form controls">
        <Label htmlFor="token-input">Label</Label>
        <Input
          id="token-input"
          placeholder="Placeholder"
          className="max-w-52"
        />
        <Input
          aria-label="Disabled input"
          placeholder="Disabled"
          disabled
          className="max-w-52"
        />
        <Input
          aria-label="Invalid input"
          placeholder="Invalid"
          aria-invalid
          className="max-w-52"
        />
        <Checkbox aria-label="Checkbox" />
        <Switch aria-label="Switch" />
        <Switch aria-label="Disabled switch" disabled />
      </Row>

      <Row title="textarea">
        <Textarea
          aria-label="Multi-line input"
          placeholder="Multi-line input"
          className="max-w-md"
        />
      </Row>

      <Row title="tabs">
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">7d</TabsTrigger>
            <TabsTrigger value="b">30d</TabsTrigger>
            <TabsTrigger value="c">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </Row>

      <Row title="skeleton shapes">
        <Skeleton shape="circle" className="size-10" />
        <Skeleton className="h-10 w-32" />
        <Skeleton shape="text" className="w-40" />
      </Row>

      <Row title="separator">
        <div className="flex w-64 flex-col gap-2">
          <span className="text-sm">Above</span>
          <Separator />
          <span className="text-sm">Below</span>
        </div>
      </Row>

      <div className="flex flex-col gap-2">
        <code className="text-[11px] text-muted-foreground">alerts</code>
        <div className="flex max-w-md flex-col gap-2">
          <Alert>
            <AlertTitle>Default</AlertTitle>
            <AlertDescription>A neutral notice.</AlertDescription>
          </Alert>
          <Alert variant="success">
            <AlertTitle>Success</AlertTitle>
          </Alert>
          <Alert variant="warning">
            <AlertTitle>Warning</AlertTitle>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Destructive</AlertTitle>
          </Alert>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <code className="text-[11px] text-muted-foreground">
          card and table
        </code>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Tracked keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableCaption className="sr-only">
                Primitive table sample with a numeric column.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Traffic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>focus timer</TableCell>
                  <TableCell className="numeric font-mono">3</TableCell>
                  <TableCell className="numeric font-mono">5,000</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>productivity app</TableCell>
                  <TableCell className="numeric font-mono">&gt;200</TableCell>
                  <TableCell className="numeric font-mono">8,000</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
