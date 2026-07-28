import {
  Newspaper,
  Rocket,
  Banknote,
  Users,
  MessageSquare,
  Tag,
  Scale,
  Radio,
} from "lucide-react";

const CATEGORIES = [
  { icon: Newspaper, label: "News & Media" },
  { icon: Rocket, label: "Product Launches" },
  { icon: Banknote, label: "Funding Rounds" },
  { icon: Users, label: "Hiring Signals" },
  { icon: MessageSquare, label: "Social Sentiment" },
  { icon: Tag, label: "Pricing Changes" },
  { icon: Scale, label: "Regulatory Moves" },
  { icon: Radio, label: "Brand Coverage" },
];

/** Infinite scrolling ticker of the intelligence categories Kironyx watches. */
export function CategoryMarquee() {
  return (
    <div className="mask-fade-x relative mx-auto mt-14 max-w-5xl overflow-hidden" aria-hidden>
      <div className="flex w-max animate-marquee">
        {[0, 1].map((half) => (
          <div key={half} className="flex items-center gap-4 pr-4">
            {CATEGORIES.map((category) => (
              <div
                key={category.label}
                className="flex shrink-0 items-center gap-2 rounded-full border border-ink/[0.08] bg-obsidian-900/60 px-4 py-2 text-sm text-muted-foreground"
              >
                <category.icon className="h-4 w-4 text-ink/45" />
                {category.label}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
