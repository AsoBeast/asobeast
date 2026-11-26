"use client";

import {
  chartGenreName,
  chartGenresOf,
  OVERALL_GENRE,
  type ChartGenre,
  type ChartGenreGroup,
  type Store,
} from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/lib/use-app-locale";
import { genreNameInLocale } from "./genre-name";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function groupsOf(store: Store): Array<[ChartGenreGroup, ChartGenre[]]> {
  const groups = new Map<ChartGenreGroup, ChartGenre[]>();
  for (const genre of chartGenresOf(store)) {
    if (genre.id === OVERALL_GENRE) continue;
    groups.set(genre.group, [...(groups.get(genre.group) ?? []), genre]);
  }
  return [...groups];
}

export function GenreSelect({
  store,
  value,
  onChange,
}: {
  store: Store;
  value: string;
  onChange: (genre: string) => void;
}) {
  const t = useTranslations("topCharts");
  const locale = useAppLocale();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={t("category")} className="w-[220px]">
        <SelectValue>
          {genreNameInLocale(chartGenreName(store, value) ?? value, locale)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={OVERALL_GENRE}>{t("genres.overall")}</SelectItem>
        {groupsOf(store).map(([group, genres]) => (
          <SelectGroup key={group}>
            <SelectLabel>{t(`genres.${group}`)}</SelectLabel>
            {genres.map((genre) => (
              <SelectItem key={genre.id} value={genre.id}>
                {genre.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
