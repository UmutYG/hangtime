import { Lang } from "./i18n";
import { VisionCard } from "./settings";

// The permanent, non-editable vision (rendered in VisionScreen): the ability to
// see the positive is itself the base skill everything else rests on. Anything
// that doesn't clearly connect to one of the user's own visions still belongs
// somewhere real — it lands here instead of a vague "unmatched" bucket.
export const DEFAULT_VISION_ID = "default-positive-skill";

export function defaultVisionText(t: (key: string) => string): string {
  return t("vision.defaultText");
}

// A stand-in VisionCard for places (Flow, Journey-style views) that expect a
// real card shape to render a tint/title for the default vision.
export function defaultVisionCard(lang: Lang, t: (key: string) => string): VisionCard {
  return {
    id: DEFAULT_VISION_ID,
    text: defaultVisionText(t),
    tint: 1, // sage — matches the badge styling in VisionScreen
    createdAt: 0,
  };
}
