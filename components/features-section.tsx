import {
  CloudCheckIcon,
  FoldersIcon,
  LightningIcon,
  LockKeyIcon,
  MagnifyingGlassIcon,
  StethoscopeIcon,
} from "@phosphor-icons/react/dist/ssr";

const features = [
  {
    icon: CloudCheckIcon,
    title: "Access Anywhere",
    description: "Use Sheltermark on any device with a browser and internet.",
  },
  {
    icon: LightningIcon,
    title: "Auto Fetch Metadata",
    description:
      "Bookmarks are enriched with titles, images, and favicons. Make it easy to recognize.",
  },
  {
    icon: StethoscopeIcon,
    title: "Weekly Checks",
    description: "We keep your links healthy. Broken links? We flag them.",
  },
  {
    icon: LockKeyIcon,
    title: "Private by Default",
    description:
      "Your data stays private. Share workspaces and bookmarks under your own control.",
  },
  {
    icon: FoldersIcon,
    title: "Smart Workspaces",
    description:
      "Organize bookmarks into dedicated spaces for personal, work or any other purpose.",
  },
  {
    icon: MagnifyingGlassIcon,
    title: "Instant Search",
    description:
      "Find any bookmark in milliseconds. Results appear as you type.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 md:py-24 px-4 max-w-2xl mx-auto">
      <div className="grid grid-cols-1 justify-center gap-4">
        {features.map((feature) => (
          <div key={feature.title} className="flex gap-4 p-2">
            <div className="shrink-0 w-12 h-12 flex items-center justify-center">
              <feature.icon className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
              <p className="text-base text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
