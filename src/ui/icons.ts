// One place that maps semantic icon keys (used in the YAML) to Tabler icon components.
import {
  IconAirConditioning,
  IconBuildingFactory2,
  IconBan,
  IconBatteryCharging2,
  IconBolt,
  IconBuilding,
  IconBuildingCommunity,
  IconBuildingCottage,
  IconCalendar,
  IconCar,
  IconCircle,
  IconClock,
  IconCoin,
  IconCooker,
  IconDeviceMobile,
  IconDeviceMobileMessage,
  IconDots,
  IconDropletBolt,
  IconDropletFlame,
  IconDroplets,
  IconFlame,
  IconHelp,
  IconHome,
  IconKey,
  IconLock,
  IconPigMoney,
  IconPipeline,
  IconPlant,
  IconPool,
  IconRipple,
  IconShieldCheck,
  IconSpiral,
  IconSolarPanel2,
  IconTemperatureSun,
  IconToolsKitchen2,
  IconUser,
  IconUsersGroup,
  IconWashMachine,
  IconWood,
  createReactComponent,
  type Icon,
} from "@tabler/icons-react";
import { ICON_KEYS } from "./iconKeys.ts";

// Own outline icons in Tabler's 24×24 grid, for appliances Tabler does not draw.
const MACHINE = "M5 5a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2l0 -14";
/** Tumble dryer: the washing-machine body with rising heat waves in the door instead of water. */
const IconTumbleDryer = createReactComponent("outline", "tumble-dryer", "TumbleDryer", [
  ["path", { d: MACHINE, key: "d0" }],
  ["path", { d: "M8 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", key: "d1" }],
  ["path", { d: "M8 6h.01", key: "d2" }],
  ["path", { d: "M11 6h.01", key: "d3" }],
  ["path", { d: "M14 6h2", key: "d4" }],
  ["path", { d: "M11 12.5c-.6 .5 -.6 1 0 1.5s.6 1 0 1.5", key: "d5" }],
  ["path", { d: "M13.5 12.5c-.6 .5 -.6 1 0 1.5s.6 1 0 1.5", key: "d6" }],
]);
/** Oven: control strip with knobs above a glass door. */
const IconOven = createReactComponent("outline", "oven", "Oven", [
  ["path", { d: "M4 5a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z", key: "o0" }],
  ["path", { d: "M4 8h16", key: "o1" }],
  ["path", { d: "M7 5.5h.01", key: "o2" }],
  ["path", { d: "M10 5.5h.01", key: "o3" }],
  ["path", { d: "M7 11h10v6h-10z", key: "o4" }],
]);
/** Hob seen from above: four cooking zones. */
const IconHob = createReactComponent("outline", "hob", "Hob", [
  ["path", { d: "M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z", key: "h0" }],
  ["path", { d: "M5.5 9a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0", key: "h1" }],
  ["path", { d: "M14 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0", key: "h2" }],
  ["path", { d: "M6.5 15.5a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0", key: "h3" }],
  ["path", { d: "M13.5 15.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0", key: "h4" }],
]);

const ICONS: Record<(typeof ICON_KEYS)[number], Icon> = {
  hoszivattyu: IconTemperatureSun,
  klima: IconAirConditioning,
  bojler: IconDropletBolt,
  futes: IconFlame,
  auto: IconCar,
  napelem: IconSolarPanel2,
  akkumulator: IconBatteryCharging2,
  mosogep: IconWashMachine,
  mosogatogep: IconToolsKitchen2,
  szarito: IconTumbleDryer,
  fozes: IconCooker,
  szivattyu: IconRipple,
  nincs: IconBan,
  nemtudom: IconHelp,
  haz: IconHome,
  lakas: IconBuildingCommunity,
  tanya: IconBuildingCottage,
  berlet: IconKey,
  telefon: IconDeviceMobile,
  sms: IconDeviceMobileMessage,
  kozosseg: IconUsersGroup,
  penz: IconCoin,
  persely: IconPigMoney,
  pajzs: IconShieldCheck,
  lakat: IconLock,
  ember: IconUser,
  epulet: IconBuilding,
  villam: IconBolt,
  naptar: IconCalendar,
  ora: IconClock,
  egyeb: IconDots,
  tekercs: IconSpiral,
  suto: IconOven,
  fozolap: IconHob,
  medence: IconPool,
  ontozes: IconPlant,
  gazkonvektor: IconFlame,
  gazkazan: IconDropletFlame,
  kondenz: IconDroplets,
  fa: IconWood,
  vegyes: IconBuildingFactory2,
  tavfutes: IconPipeline,
};

/** Unknown or missing keys fall back to a generic icon and never throw. */
export function iconFor(key: string | undefined): Icon {
  if (key && Object.prototype.hasOwnProperty.call(ICONS, key)) return (ICONS as Record<string, Icon>)[key];
  return IconCircle;
}
