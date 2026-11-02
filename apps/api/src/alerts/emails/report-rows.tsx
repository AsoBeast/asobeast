import { Column, Img, Row, Text } from 'react-email';
import type { ReportRow } from '../report/report';

const ROW_TEXT =
  'm-0 text-[14px] leading-[22px] text-body dark:text-night-body';
const MUTED_TEXT =
  'm-0 text-[13px] leading-[20px] text-muted dark:text-night-muted';
const CHANGE_ICON_SIZE = 32;

function MoveRow({ row }: { row: Extract<ReportRow, { kind: 'move' }> }) {
  return (
    <Row>
      <Column className="align-top wrap-anywhere">
        <Text className={ROW_TEXT}>{row.label}</Text>
      </Column>
      <Column className="w-[112px] whitespace-nowrap align-top">
        <Text className={ROW_TEXT}>{`${row.from} → ${row.to}`}</Text>
      </Column>
      <Column className="align-top">
        <Text className={MUTED_TEXT}>{row.note ?? ''}</Text>
      </Column>
    </Row>
  );
}

function TextRow({ row }: { row: Extract<ReportRow, { kind: 'text' }> }) {
  return (
    <>
      <Text className={ROW_TEXT}>{row.text}</Text>
      {row.detail && <Text className={MUTED_TEXT}>{row.detail}</Text>}
    </>
  );
}

function ChangeRow({ row }: { row: Extract<ReportRow, { kind: 'change' }> }) {
  return (
    <Text className={ROW_TEXT}>
      <span className="font-medium">{row.field}</span>
      {`: ${row.before} → ${row.after}`}
    </Text>
  );
}

function ChangedIcon({ url, alt }: { url: string | null; alt: string }) {
  return url ? (
    <Img
      src={url}
      alt={alt}
      width={CHANGE_ICON_SIZE}
      height={CHANGE_ICON_SIZE}
      className="rounded-[7px]"
    />
  ) : (
    <Text className={MUTED_TEXT}>none</Text>
  );
}

function ImageRow({ row }: { row: Extract<ReportRow, { kind: 'image' }> }) {
  return (
    <Row>
      <Column className="w-[112px] align-middle">
        <Text className={ROW_TEXT}>{row.field}</Text>
      </Column>
      <Column className="w-[40px] align-middle">
        <ChangedIcon url={row.beforeUrl} alt="Previous icon" />
      </Column>
      <Column className="w-[24px] align-middle">
        <Text className={ROW_TEXT}>→</Text>
      </Column>
      <Column className="align-middle">
        <ChangedIcon url={row.afterUrl} alt="New icon" />
      </Column>
    </Row>
  );
}

export function ReportRowView({ row }: { row: ReportRow }) {
  switch (row.kind) {
    case 'move':
      return <MoveRow row={row} />;
    case 'text':
      return <TextRow row={row} />;
    case 'change':
      return <ChangeRow row={row} />;
    case 'image':
      return <ImageRow row={row} />;
  }
}
