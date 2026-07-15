import { useState } from "react";
import { ArrowLeft, BookOpen, LayoutGrid, User } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharactersPanel } from "@/features/dm/characters-panel";
import { FoundrySessionPanel } from "@/features/dm/foundry-session-panel";
import { GlossaryPanel } from "@/features/dm/glossary-panel";
import { StacksPanel } from "@/features/dm/stacks-panel";
import { getOrCreateUserId } from "@/lib/user-id";

export default function DmSpace() {
  const [, setLocation] = useLocation();
  const [userId] = useState(getOrCreateUserId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocation("/")}
                data-testid="button-main-menu"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Main Menu
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-spiritual-700 dark:text-spiritual-400">
                  DM Space
                </h1>
                <p className="mt-1 text-lg text-gray-600 dark:text-gray-300">
                  Manage stacks, characters, and glossary
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocation("/card-game")}
              data-testid="button-card-game"
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Card Game
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <FoundrySessionPanel />
        <Tabs defaultValue="stacks" className="w-full">
          <TabsList className="mx-auto mb-8 grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="stacks" data-testid="tab-stacks">
              Stack Tracker
            </TabsTrigger>
            <TabsTrigger value="characters" data-testid="tab-characters">
              <User className="mr-2 h-4 w-4" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="glossary" data-testid="tab-glossary">
              <BookOpen className="mr-2 h-4 w-4" />
              Glossary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stacks">
            <StacksPanel userId={userId} />
          </TabsContent>
          <TabsContent value="characters">
            <CharactersPanel userId={userId} />
          </TabsContent>
          <TabsContent value="glossary">
            <GlossaryPanel userId={userId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
