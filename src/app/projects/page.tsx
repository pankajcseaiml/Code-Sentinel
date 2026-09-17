import { QueryClient } from "@tanstack/react-query";
import { Footer } from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProjectList } from "./components/ProjectList";
import { projetsQueryConfig } from "./hooks/useProjects";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ProjectsPage() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: projetsQueryConfig.queryKey,
    queryFn: projetsQueryConfig.queryFn,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      <HeroSection />

      <div className="container mx-auto px-4 py-8 flex-1">
        <main>
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Projects</h2>
              <CreateProjectDialog />
            </div>

            <ProjectList />
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
