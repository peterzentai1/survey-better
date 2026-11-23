import type { Card } from "../engine/schema.ts";
import { ConsentCard, FreeTextCard, InfoCard, SingleCard } from "./cards/basic.tsx";
import { MultiTilesCard } from "./cards/MultiTilesCard.tsx";
import { Scale6Card } from "./cards/Scale6Card.tsx";
import { SummaryCard } from "./cards/SummaryCard.tsx";
import { TimelineCard } from "./cards/TimelineCard.tsx";
import { YesNoCard } from "./cards/YesNoCard.tsx";

/** Pick the component for a card type. The caller keys it by card id so local state resets per card. */
export function CardView({ card }: { card: Card }) {
  switch (card.type) {
    case "info":
      return <InfoCard card={card} />;
    case "consent":
      return <ConsentCard card={card} />;
    case "single":
      return <SingleCard card={card} />;
    case "multi_tiles":
      return <MultiTilesCard card={card} />;
    case "yesno":
      return <YesNoCard card={card} />;
    case "scale6":
      return <Scale6Card card={card} />;
    case "timeline":
      return <TimelineCard card={card} />;
    case "free_text":
      return <FreeTextCard card={card} />;
    case "summary_highlight":
      return <SummaryCard card={card} />;
  }
}
