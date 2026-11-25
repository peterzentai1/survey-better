// scale6: six segment buttons; the interaction itself lives in SegmentedChoice.
import { REACTION_CARD, temperatureArm } from "../../engine/temperature.ts";
import { scaleOf, type Card } from "../../engine/schema.ts";
import { CardShell } from "../CardShell.tsx";
import { useCardApi } from "../session.tsx";
import { SegmentedChoice } from "./SegmentedChoice.tsx";

const MARKS = ["1", "2", "3", "4", "5", "6"];

export function Scale6Card({ card }: { card: Extract<Card, { type: "scale6" }> }) {
  const api = useCardApi(card);
  const { ctx, state } = api.store.getState();
  const input = ctx.settings.display.scaleInput;
  const experimental = input === "ab_test" && card.id === REACTION_CARD;
  const dragPad = input === "drag_reveal" || (experimental && temperatureArm(state.sessionId) === "drag");
  const scale = scaleOf(card, ctx.bank);
  const stored = api.item?.status === "answered" && typeof api.item.value === "number" ? api.item.value - 1 : null;
  return (
    <CardShell api={api}>
      <SegmentedChoice
        api={api}
        marks={MARKS}
        names={scale.labels}
        stored={stored}
        onSelect={(i, how) => {
          api.commit(i + 1, how);
          api.autoAdvance();
        }}
        dragPad={dragPad}
        trackPointer={!experimental || dragPad}
        experimental={experimental}
        left={scale.left}
        right={scale.right}
      />
    </CardShell>
  );
}
