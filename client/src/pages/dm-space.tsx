import { useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlossaryPanel } from "@/features/dm/glossary-panel";
import { StacksPanel } from "@/features/dm/stacks-panel";
import { getOrCreateUserId } from "@/lib/user-id";

export default function DmSpace() {
  const [, setLocation] = useLocation();
  const [userId] = useState(getOrCreateUserId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocation("/")}
                data-testid="button-main-menu"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Main Menu
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-spiritual-700 dark:text-spiritual-400">
                  DM Space
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">
                  Manage Stacks &amp; Glossary
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="stacks" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="stacks" data-testid="tab-stacks">
              Stack Tracker
            </TabsTrigger>
            <TabsTrigger value="glossary" data-testid="tab-glossary">
              <BookOpen className="w-4 h-4 mr-2" />
              Glossary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stacks">
            <StacksPanel userId={userId} />
          </TabsContent>
          <TabsContent value="glossary">
            <GlossaryPanel userId={userId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
