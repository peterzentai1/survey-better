// single with layout "count": ordered numbers (e.g. household size) as tap buttons or a drag pad.
// The surface follows the respondent's A/B input arm, so each arm practises one interface throughout.
import { temperatureArm } from "../../engine/temperature.ts";
import { visibleOptions } from "../../engine/inputs.ts";
import type { Card } from "../../engine/schema.ts";
import { CardShell } from "../CardShell.tsx";
import { useCardApi } from "../session.tsx";
import { SegmentedChoice } from "./SegmentedChoice.tsx";

export function CountCard({ card }: { card: Extract<Card, { type: "single" }> }) {
  const api = useCardApi(card);
  const { ctx, state } = api.store.getState();
  const input = ctx.settings.display.scaleInput;
  const experimental = input === "ab_test";
  const dragPad = input === "drag_reveal" || (experimental && temperatureArm(state.sessionId) === "drag");
  const options = visibleOptions(card, api.analysis.view);
  const value = api.item?.status === "answered" ? api.item.value : undefined;
  const index = options.findIndex((o) => o.value === value);
  return (
    <CardShell api={api}>
      <SegmentedChoice
        api={api}
        marks={options.map((o) => o.value)}
        names={options.map((o) => o.label)}
        stored={index < 0 ? null : index}
        onSelect={(i) => {
          api.commit(options[i].value);
          api.autoAdvance();
        }}
        dragPad={dragPad}
        trackPointer={!experimental || dragPad}
        experimental={experimental}
      />
    </CardShell>
  );
}
