import { LifecycleStory, type LifecycleStage } from "@/components/intact/LifecycleStory";

const stages: LifecycleStage[] = ["quote", "decide", "protect", "recover"];

function isStage(value: string | string[] | undefined): value is LifecycleStage {
  return typeof value === "string" && stages.includes(value as LifecycleStage);
}

export default async function IntactHome({ searchParams }: PageProps<"/intact">) {
  const params = await searchParams;
  const initialStage = isStage(params.stage) ? params.stage : "quote";
  const expoUrl = process.env.NEXT_PUBLIC_EXPO_URL ?? "http://macserver:8081";

  return (
    <main className="intact-page intact-lifecycle-page">
      <div
        hidden
        dangerouslySetInnerHTML={{
          __html:
            "<!-- THESIS: Insurance should keep the same consented facts connected from shopping through recovery. OWN-WORLD: The established Intact blue-grey field, deep teal type, vermilion actions, ruled service-paper structure, and working product routes. STORY: Trace Expo, deterministic data, MCP tools, and human support into Quote, Decide, Protect, and Recover; every Home and Auto capability stays visible as a connected child node. FIRST VIEWPORT: One complete flowchart shows the shared systems, lifecycle stages, concrete capabilities, and proof links without requiring interaction. FORM: A user-pinned connected system graph, selected after comparing timeline, split-screen, storyboard, and dashboard structures. -->",
        }}
      />
      <LifecycleStory initialStage={initialStage} expoUrl={expoUrl} />
    </main>
  );
}
