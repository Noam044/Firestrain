import { Story } from "@/components/story/Story";
import statsJson from "@/public/data/effis/stats.json";
import storyJson from "@/public/data/story/story.json";
import { manifest, mapCredits } from "@/lib/data/manifest";
import { EffisStatsSchema, StorySchema } from "@/lib/data/schemas";

// Validated at build time: the page fails to build rather than tell a story with malformed figures.
const story = StorySchema.parse(storyJson);
const stats = EffisStatsSchema.parse(statsJson);

export default function StoryPage() {
  return (
    <main id="contenu">
      <Story
        story={story}
        weekly={stats.weekly}
        credits={mapCredits({ fires: true })}
        retrieved={{
          effis: manifest.files[`effis/fires-${story.year}.json`]?.retrievedAt,
          stats: manifest.files["effis/stats.json"]?.retrievedAt,
          firms: manifest.files[`firms/detections-${story.year}.bin`]?.retrievedAt,
          story: manifest.files["story/story.json"]?.retrievedAt,
        }}
      />
    </main>
  );
}
