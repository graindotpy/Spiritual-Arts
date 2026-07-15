import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  EyeOff,
  ImagePlus,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CampaignMark } from "@/components/campaign-mark";
import FoundryMechanicsEditor from "@/components/foundry-mechanics-editor";
import {
  EnhancedContentDialog,
  type EnhancedContentSaveData,
} from "@/components/enhanced-content-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
} from "@/components/ui/dialog";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { useToast } from "@/hooks/use-toast";
import { requestJson } from "@/lib/api";
import {
  normalizeFoundryMechanics,
  parseStoredFoundryMechanics,
} from "@/lib/foundry-mechanics-draft";
import { characterKeys, instrumentKeys } from "@/lib/query-keys";
import { createUuid } from "@/lib/uuid";
import {
  RichTextEditor,
  RichTextErrorBoundary,
} from "@/features/enhanced-content/rich-text";
import {
  richTextContentToPlainText,
  serializeRichTextContent,
} from "@shared/enhanced-content";
import {
  foundryMechanicsSchema,
  type FoundryMechanics,
} from "@shared/mechanics";
import {
  MAX_INSTRUMENT_ACTIONS,
  instrumentActionsSchema,
  type Character,
  type SpiritualInstrumentWithAssignments,
  type TriggerType,
} from "@shared/schema";

type InstrumentActionDraft = {
  id: string;
  name: string;
  description: string;
  actionType: TriggerType;
  mechanics?: FoundryMechanics;
  storedMechanicsError?: string;
};

type InstrumentDraft = {
  name: string;
  description: string;
  imageUrl: string | null;
  isRevealed: boolean;
  characterIds: string[];
  actions: InstrumentActionDraft[];
};

const emptyDraft: InstrumentDraft = {
  name: "",
  description: "",
  imageUrl: null,
  isRevealed: true,
  characterIds: [],
  actions: [],
};

function createInstrumentActionDraft(): InstrumentActionDraft {
  return {
    id: createUuid(),
    name: "",
    description: "",
    actionType: "action",
  };
}

function prepareInstrumentActions(actions: InstrumentActionDraft[]) {
  return actions.map((action) => {
    const mechanics = normalizeFoundryMechanics(action.mechanics);
    return {
      id: action.id,
      name: action.name.trim(),
      description: action.description,
      actionType: action.actionType,
      ...(mechanics ? { mechanics } : {}),
    };
  });
}

const toolbarButtonClass =
  "campaign-toolbar-button border-[#b8aa90]/70 bg-[#fffaf0]/65 text-[#27352f] shadow-sm backdrop-blur transition-colors hover:border-[#557d6f] hover:bg-[#fffaf0] hover:text-[#204e42] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#e9e2d3] dark:hover:border-[#82a99a]/60 dark:hover:bg-white/[0.1] dark:hover:text-white";

const activeDmButtonClass =
  "border-[#557d6f] bg-[#dce9df] text-[#204e42] shadow-sm hover:bg-[#d2e2d8] dark:border-[#82a99a]/60 dark:bg-[#31584c]/60 dark:text-[#e7f1ec] dark:hover:bg-[#31584c]/80";

export default function InstrumentVault() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDmMode, setDmMode] = useState(
    () => localStorage.getItem("dmMode") === "true",
  );
  const [search, setSearch] = useState("");
  const [groupByCharacter, setGroupByCharacter] = useState(false);
  const [editing, setEditing] = useState<SpiritualInstrumentWithAssignments | null>(null);
  const [draft, setDraft] = useState<InstrumentDraft>(emptyDraft);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assigning, setAssigning] =
    useState<SpiritualInstrumentWithAssignments | null>(null);
  const [assignmentCharacterIds, setAssignmentCharacterIds] = useState<string[]>([]);
  const [expandedInstrument, setExpandedInstrument] =
    useState<SpiritualInstrumentWithAssignments | null>(null);
  const [uploading, setUploading] = useState(false);

  const instrumentsQuery = useQuery<SpiritualInstrumentWithAssignments[]>({
    queryKey: instrumentKeys.all(isDmMode),
    queryFn: () =>
      requestJson("GET", `/api/instruments${isDmMode ? "?includeHidden=true" : ""}`),
  });
  const charactersQuery = useQuery<Character[]>({ queryKey: characterKeys.all });
  const instruments = instrumentsQuery.data ?? [];
  const characters = charactersQuery.data ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    if (!needle) return instruments;
    return instruments.filter((instrument) => {
      const assignedNames = characters
        .filter((character) => instrument.characterIds.includes(character.id))
        .map((character) => character.name)
        .join(" ");
      return `${instrument.name} ${instrument.description} ${assignedNames}`
        .toLocaleLowerCase()
        .includes(needle);
    });
  }, [characters, instruments, search]);

  const groups = useMemo(() => {
    if (!groupByCharacter) return [{ id: "all", name: "All instruments", items: filtered }];
    const assigned = characters
      .map((character) => ({
        id: character.id,
        name: character.name,
        items: filtered.filter((instrument) => instrument.characterIds.includes(character.id)),
      }))
      .filter((group) => group.items.length > 0);
    const unassigned = filtered.filter((instrument) => instrument.characterIds.length === 0);
    return unassigned.length
      ? [...assigned, { id: "unassigned", name: "Unassigned", items: unassigned }]
      : assigned;
  }, [characters, filtered, groupByCharacter]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/instruments"] });
  };

  const saveInstrument = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        imageUrl: draft.imageUrl,
        isRevealed: draft.isRevealed,
        actions: prepareInstrumentActions(draft.actions),
      };
      const instrument = editing
        ? await requestJson<SpiritualInstrumentWithAssignments>(
            "PUT",
            `/api/instruments/${editing.id}`,
            body,
          )
        : await requestJson<SpiritualInstrumentWithAssignments>("POST", "/api/instruments", body);
      return requestJson<SpiritualInstrumentWithAssignments>(
        "PUT",
        `/api/instruments/${instrument.id}/assignments`,
        { characterIds: draft.characterIds },
      );
    },
    onSuccess: async () => {
      await refresh();
      setDialogOpen(false);
      toast({ title: editing ? "Instrument updated" : "Instrument added to the vault" });
    },
    onError: () => toast({ title: "Instrument could not be saved", variant: "destructive" }),
  });

  const deleteInstrument = useMutation({
    mutationFn: (id: string) => requestJson("DELETE", `/api/instruments/${id}`),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Instrument removed" });
    },
    onError: () => toast({ title: "Instrument could not be removed", variant: "destructive" }),
  });

  const saveAssignments = useMutation({
    mutationFn: ({
      instrumentId,
      characterIds,
    }: {
      instrumentId: string;
      characterIds: string[];
    }) =>
      requestJson<SpiritualInstrumentWithAssignments>(
        "PUT",
        `/api/instruments/${instrumentId}/assignments`,
        { characterIds },
      ),
    onSuccess: async () => {
      await refresh();
      setAssigning(null);
      toast({ title: "Instrument assignments updated" });
    },
    onError: () =>
      toast({ title: "Instrument assignments could not be updated", variant: "destructive" }),
  });

  const saveEnhancedContent = useMutation({
    mutationFn: ({
      instrumentId,
      data,
    }: {
      instrumentId: string;
      data: EnhancedContentSaveData;
    }) =>
      requestJson<SpiritualInstrumentWithAssignments>(
        "PUT",
        `/api/instruments/${instrumentId}`,
        {
          description: data.summary,
          expandedContent: data.expandedContent,
          hasExpandedContent: data.hasExpandedContent,
        },
      ),
    onSuccess: async (instrument) => {
      setExpandedInstrument(instrument);
      await refresh();
      toast({ title: "Instrument details saved" });
    },
    onError: () =>
      toast({ title: "Instrument details could not be saved", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...emptyDraft, characterIds: [], actions: [] });
    setDialogOpen(true);
  };

  const openEdit = (instrument: SpiritualInstrumentWithAssignments) => {
    setEditing(instrument);
    setDraft({
      name: instrument.name,
      description: instrument.description,
      imageUrl: instrument.imageUrl,
      isRevealed: instrument.isRevealed,
      characterIds: instrument.characterIds,
      actions: instrument.actions.map((action) => {
        const storedMechanics = parseStoredFoundryMechanics(action.mechanics);
        return {
          ...action,
          mechanics: storedMechanics.mechanics,
          storedMechanicsError: storedMechanics.error,
        };
      }),
    });
    setDialogOpen(true);
  };

  const openAssignments = (instrument: SpiritualInstrumentWithAssignments) => {
    setAssigning(instrument);
    setAssignmentCharacterIds(instrument.characterIds);
  };

  const updateInstrumentAction = <K extends keyof InstrumentActionDraft>(
    actionId: string,
    field: K,
    value: InstrumentActionDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      actions: current.actions.map((action) =>
        action.id === actionId ? { ...action, [field]: value } : action,
      ),
    }));
  };

  const removeInstrumentAction = (actionId: string) => {
    setDraft((current) => ({
      ...current,
      actions: current.actions.filter((action) => action.id !== actionId),
    }));
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const result = await requestJson<{ url: string }>("POST", "/api/upload/image", form);
      setDraft((current) => ({ ...current, imageUrl: result.url }));
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.description.trim()) return;

    const unsupportedMechanics = draft.actions.find(
      (action) => action.storedMechanicsError,
    );
    if (unsupportedMechanics) {
      toast({
        title: `Stored Foundry mechanics need attention for ${unsupportedMechanics.name || "this action"}`,
        description:
          "Open its Foundry mechanics and explicitly discard the unsupported block before saving.",
        variant: "destructive",
      });
      return;
    }

    const incompleteAction = draft.actions.find(
      (action) =>
        !action.name.trim() ||
        !richTextContentToPlainText(action.description).trim(),
    );
    if (incompleteAction) {
      toast({
        title: "Complete each instrument action",
        description: "Every action needs a name and description.",
        variant: "destructive",
      });
      return;
    }

    for (const action of draft.actions) {
      const mechanics = normalizeFoundryMechanics(action.mechanics);
      if (!mechanics) continue;
      const parsedMechanics = foundryMechanicsSchema.safeParse(mechanics);
      if (!parsedMechanics.success) {
        toast({
          title: `Check Foundry mechanics for ${action.name}`,
          description:
            parsedMechanics.error.issues[0]?.message ??
            "One of the configured Foundry actions is invalid.",
          variant: "destructive",
        });
        return;
      }
    }

    const parsedActions = instrumentActionsSchema.safeParse(
      prepareInstrumentActions(draft.actions),
    );
    if (!parsedActions.success) {
      toast({
        title: "Instrument actions could not be saved",
        description:
          parsedActions.error.issues[0]?.message ??
          "Check the configured instrument actions.",
        variant: "destructive",
      });
      return;
    }

    saveInstrument.mutate();
  };

  const toggleDmMode = () => {
    if (isDmMode) {
      localStorage.removeItem("dmMode");
      localStorage.removeItem("adminMode");
      setDmMode(false);
      toast({ title: "DM Mode deactivated" });
      return;
    }

    const code = typeof window !== "undefined" && typeof window.prompt === "function"
      ? window.prompt("Enter the DM Mode code:")
      : null;
    if (code === null) return;
    if (code.trim() !== "31428") {
      toast({
        title: "Incorrect code",
        description: "DM Mode was not activated.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("dmMode", "true");
    setDmMode(true);
    toast({
      title: "DM Mode activated",
      description: "Hidden instruments and vault controls are now available.",
    });
  };

  return (
    <div className="wuxia-shell min-h-screen">
      <div className="wuxia-orb wuxia-orb-left" aria-hidden="true" />
      <div className="wuxia-orb wuxia-orb-right" aria-hidden="true" />
      <header className="wuxia-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <CampaignMark />
            <div className="min-w-0">
              <p className="wuxia-kicker mb-0.5">Spiritual Arts</p>
              <label htmlFor="vault-page-selector" className="sr-only">Select page</label>
              <Select value="/instrument-vault" onValueChange={setLocation}>
                <SelectTrigger
                  id="vault-page-selector"
                  className="font-display h-auto w-[13.5rem] border-0 bg-transparent p-0 text-left text-2xl leading-none text-[#1f342d] shadow-none focus:ring-1 focus:ring-[#8d6b40] dark:text-[#ead9b6] [&>svg]:ml-2 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-[#8e7958] [&>span]:line-clamp-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="wuxia-select-content">
                  <SelectItem value="/">Path Manuals</SelectItem>
                  <SelectItem value="/instrument-vault">Instrument Vault</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Vault tools">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleDmMode}
              className={isDmMode ? activeDmButtonClass : toolbarButtonClass}
              aria-pressed={isDmMode}
              data-testid="button-dm-mode"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              DM Mode
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLocation("/")}
              className={toolbarButtonClass}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Path Manuals
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 py-8 sm:py-10">
        <section className="wuxia-paper relative mx-auto rounded-[1.5rem] p-5 sm:p-8 dark:rounded-sm">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="wuxia-kicker">Party collection</p>
              <h2 className="font-display mt-2 text-3xl text-[#253b33] sm:text-4xl dark:text-[#f0e3ca]">
                Spiritual Instruments
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666a63] dark:text-[#b7a98c]">
                Party-wide collection and tracking of Spiritual Instruments.
              </p>
            </div>
            {isDmMode && (
              <Button className="wuxia-primary-action" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Create instrument
              </Button>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search instruments, descriptions, or characters…"
                className="vault-filter-control pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setGroupByCharacter((value) => !value)}
              aria-pressed={groupByCharacter}
              className={groupByCharacter ? activeDmButtonClass : "wuxia-secondary-action"}
            >
              <Users className="mr-2 h-4 w-4" /> Group by character
            </Button>
          </div>

          {instrumentsQuery.isLoading ? (
            <p className="py-16 text-center text-muted-foreground">Opening the vault…</p>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-[#8d6b40]" />
              <p className="font-display mt-3 text-xl">No instruments found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? "Try a different search." : "The vault is waiting for its first treasure."}
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-9">
              {groups.map((group) => (
                <section key={group.id}>
                  {groupByCharacter && (
                    <h3 className="font-display mb-4 border-b border-[#cdbfa7]/70 pb-2 text-2xl text-[#283f37] dark:border-[#806b48]/55 dark:text-[#eee3ce]">
                      {group.name} <span className="text-base text-muted-foreground">({group.items.length})</span>
                    </h3>
                  )}
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((instrument) => (
                      <InstrumentCard
                        key={`${group.id}-${instrument.id}`}
                        instrument={instrument}
                        characters={characters}
                        isDmMode={isDmMode}
                        onOpenContent={() => setExpandedInstrument(instrument)}
                        onAssign={() => openAssignments(instrument)}
                        onEdit={() => openEdit(instrument)}
                        onDelete={() => {
                          if (confirm(`Remove “${instrument.name}” from the vault?`)) {
                            deleteInstrument.mutate(instrument.id);
                          }
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <CampaignDialogContent className="max-w-5xl">
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <CampaignDialogHeader
              icon={Sparkles}
              eyebrow="Instrument vault"
              title={editing ? "Edit Spiritual Instrument" : "Create Spiritual Instrument"}
              description="Record the physical object, its bound Impression, and who carries it."
            />
            <CampaignDialogBody className="space-y-5">
            <div>
              <Label htmlFor="instrument-name" className="wuxia-dialog-label">Instrument name</Label>
              <Input
                id="instrument-name"
                value={draft.name}
                maxLength={255}
                required
                placeholder="e.g. Lantern of Lingering Footsteps"
                className="wuxia-dialog-control"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="instrument-description" className="wuxia-dialog-label">How it works</Label>
              <Textarea
                id="instrument-description"
                value={draft.description}
                required
                rows={7}
                placeholder="Describe the Impression, its effect, and any rules for using it…"
                className="wuxia-dialog-control min-h-36 resize-y"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <section aria-labelledby="instrument-actions-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="wuxia-dialog-kicker">Character sheet</p>
                  <h3
                    id="instrument-actions-heading"
                    className="font-display text-xl text-[#2b4138] dark:text-[#eadcc2]"
                  >
                    Instrument actions
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--wuxia-dialog-muted)]">
                    Add each action granted by this instrument, then optionally configure the Foundry sequence attached to it.
                  </p>
                </div>
                <span className="rounded-sm border border-[#b9aa8f] bg-[#fffaf0]/45 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#667069] dark:border-[#806b48] dark:bg-[#4d3e29]/25 dark:text-[#c5b18d]">
                  {draft.actions.length} of {MAX_INSTRUMENT_ACTIONS}
                </span>
              </div>

              <div className="space-y-4">
                {draft.actions.map((action, index) => {
                  const nameId = `instrument-action-name-${action.id}`;
                  const typeId = `instrument-action-type-${action.id}`;
                  return (
                    <div
                      key={action.id}
                      className="wuxia-dialog-section space-y-4 p-4 sm:p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="wuxia-dialog-kicker">Instrument action {index + 1}</p>
                          <h4 className="font-display text-lg text-[#2b4138] dark:text-[#eadcc2]">
                            {action.name.trim() || "Untitled action"}
                          </h4>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="wuxia-icon-action wuxia-icon-danger h-9 w-9"
                          onClick={() => removeInstrumentAction(action.id)}
                          aria-label={`Remove ${action.name || `instrument action ${index + 1}`}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={nameId} className="wuxia-dialog-label">
                            Action name
                          </Label>
                          <Input
                            id={nameId}
                            value={action.name}
                            maxLength={255}
                            required
                            placeholder="e.g. Release the Lantern Flame"
                            className="wuxia-dialog-control"
                            onChange={(event) =>
                              updateInstrumentAction(
                                action.id,
                                "name",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={typeId} className="wuxia-dialog-label">
                            Action type
                          </Label>
                          <Select
                            value={action.actionType}
                            onValueChange={(value: TriggerType) =>
                              updateInstrumentAction(action.id, "actionType", value)
                            }
                          >
                            <SelectTrigger id={typeId} className="wuxia-dialog-control w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="wuxia-select-content">
                              <SelectItem value="action">Action</SelectItem>
                              <SelectItem value="bonus">Bonus Action</SelectItem>
                              <SelectItem value="reaction">Reaction</SelectItem>
                              <SelectItem value="passive">Passive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <RichTextErrorBoundary
                            resetKey={`instrument-action:${action.id}`}
                            fallback={
                              <Textarea
                                value={richTextContentToPlainText(action.description)}
                                onChange={(event) =>
                                  updateInstrumentAction(
                                    action.id,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                aria-label={`Description for ${action.name || `instrument action ${index + 1}`} (plain-text fallback)`}
                                placeholder="Describe how this action is used and what it does"
                                rows={6}
                                className="wuxia-dialog-control min-h-32"
                              />
                            }
                          >
                            <RichTextEditor
                              value={action.description}
                              onChange={(document) =>
                                updateInstrumentAction(
                                  action.id,
                                  "description",
                                  serializeRichTextContent(document),
                                )
                              }
                              label={`Description for ${action.name || `instrument action ${index + 1}`}`}
                              placeholder="Describe how this action is used and what it does"
                            />
                          </RichTextErrorBoundary>
                        </div>
                        <div className="sm:col-span-2">
                          <FoundryMechanicsEditor
                            mechanics={action.mechanics}
                            onChange={(mechanics) =>
                              updateInstrumentAction(action.id, "mechanics", mechanics)
                            }
                            tierLabel={action.name.trim() || `Instrument action ${index + 1}`}
                            headerEyebrow="Spiritual Instrument action"
                            headerDescription="Configure the Foundry actions stored with this instrument action."
                            storedMechanicsError={action.storedMechanicsError}
                            onDiscardStoredMechanics={() =>
                              setDraft((current) => ({
                                ...current,
                                actions: current.actions.map((candidate) =>
                                  candidate.id === action.id
                                    ? {
                                        ...candidate,
                                        mechanics: undefined,
                                        storedMechanicsError: undefined,
                                      }
                                    : candidate,
                                ),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {draft.actions.length === 0 ? (
                  <p className="wuxia-dialog-section px-4 py-5 text-sm leading-6 text-[var(--wuxia-dialog-muted)] sm:px-5">
                    This instrument has no character actions yet.
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  className="wuxia-add-row h-11 w-full"
                  disabled={draft.actions.length >= MAX_INSTRUMENT_ACTIONS}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      actions: [...current.actions, createInstrumentActionDraft()],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add instrument action
                </Button>
              </div>
            </section>
            <div className="wuxia-dialog-section p-4">
              <Label className="wuxia-dialog-label">Instrument image <span className="normal-case tracking-normal opacity-70">(optional)</span></Label>
              {draft.imageUrl && <img src={draft.imageUrl} alt="Instrument preview" className="mb-3 h-40 w-full rounded-[0.35rem] border border-[var(--wuxia-dialog-line)] object-cover" />}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="wuxia-secondary-action" disabled={uploading} onClick={() => document.getElementById("instrument-image")?.click()}>
                  <ImagePlus className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : draft.imageUrl ? "Replace image" : "Upload image"}
                </Button>
                {draft.imageUrl && <Button type="button" variant="ghost" className="text-[#765348] dark:text-[#d3a596]" onClick={() => setDraft({ ...draft, imageUrl: null })}>Remove image</Button>}
                <input id="instrument-image" className="hidden" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => e.target.files?.[0] && void uploadImage(e.target.files[0])} />
              </div>
            </div>
            <div className="wuxia-dialog-section flex items-center justify-between gap-4 p-4">
              <div>
                <Label htmlFor="instrument-revealed" className="font-semibold text-[var(--wuxia-dialog-ink)]">Revealed to players</Label>
                <p className="mt-1 text-xs leading-5 text-[var(--wuxia-dialog-muted)]">Turn this off to prepare the item privately in DM Mode.</p>
              </div>
              <Switch id="instrument-revealed" checked={draft.isRevealed} onCheckedChange={(checked) => setDraft({ ...draft, isRevealed: checked })} />
            </div>
            <div>
              <Label className="wuxia-dialog-label">Assigned characters</Label>
              <div className="wuxia-dialog-section grid gap-2 p-3 sm:grid-cols-2">
                {characters.map((character) => (
                  <label key={character.id} className="flex cursor-pointer items-center gap-2.5 rounded-[0.3rem] px-2 py-2 text-sm transition-colors hover:bg-white/40 dark:hover:bg-white/[0.04]">
                    <Checkbox
                      className="wuxia-checkbox"
                      checked={draft.characterIds.includes(character.id)}
                      onCheckedChange={(checked) => setDraft((current) => ({
                        ...current,
                        characterIds: checked === true
                          ? [...current.characterIds, character.id]
                          : current.characterIds.filter((id) => id !== character.id),
                      }))}
                    />
                    {character.name}
                  </label>
                ))}
                {characters.length === 0 && <p className="text-sm text-muted-foreground">No player characters yet.</p>}
              </div>
            </div>
            </CampaignDialogBody>
            <CampaignDialogFooter>
              <Button type="button" variant="outline" className="wuxia-secondary-action w-full sm:w-auto" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="wuxia-primary-action w-full sm:w-auto" disabled={saveInstrument.isPending || uploading}>
                {saveInstrument.isPending ? "Saving…" : "Save instrument"}
              </Button>
            </CampaignDialogFooter>
          </form>
        </CampaignDialogContent>
      </Dialog>
      <Dialog
        open={assigning !== null}
        onOpenChange={(open) => {
          if (!open && !saveAssignments.isPending) setAssigning(null);
        }}
      >
        <CampaignDialogContent className="max-w-lg">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!assigning) return;
              saveAssignments.mutate({
                instrumentId: assigning.id,
                characterIds: assignmentCharacterIds,
              });
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <CampaignDialogHeader
              icon={Users}
              eyebrow="Instrument assignment"
              title={assigning ? `Assign ${assigning.name}` : "Assign instrument"}
              description="Choose every character currently carrying or bound to this Spiritual Instrument."
            />
            <CampaignDialogBody>
              <div className="wuxia-dialog-section grid gap-2 p-3 sm:grid-cols-2">
                {characters.map((character) => (
                  <label
                    key={character.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[0.3rem] px-2 py-2 text-sm transition-colors hover:bg-white/40 dark:hover:bg-white/[0.04]"
                  >
                    <Checkbox
                      className="wuxia-checkbox"
                      checked={assignmentCharacterIds.includes(character.id)}
                      onCheckedChange={(checked) =>
                        setAssignmentCharacterIds((current) =>
                          checked === true
                            ? [...new Set([...current, character.id])]
                            : current.filter((id) => id !== character.id),
                        )
                      }
                    />
                    {character.name}
                  </label>
                ))}
                {characters.length === 0 && (
                  <p className="text-sm text-muted-foreground">No player characters yet.</p>
                )}
              </div>
            </CampaignDialogBody>
            <CampaignDialogFooter>
              <Button
                type="button"
                variant="outline"
                className="wuxia-secondary-action w-full sm:w-auto"
                disabled={saveAssignments.isPending}
                onClick={() => setAssigning(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="wuxia-primary-action w-full sm:w-auto"
                disabled={saveAssignments.isPending}
              >
                {saveAssignments.isPending ? "Saving…" : "Save assignments"}
              </Button>
            </CampaignDialogFooter>
          </form>
        </CampaignDialogContent>
      </Dialog>
      {expandedInstrument && (
        <EnhancedContentDialog
          open
          onClose={() => setExpandedInstrument(null)}
          recordKey={expandedInstrument.id}
          title={expandedInstrument.name}
          eyebrow="Instrument vault"
          description="The complete record of this Spiritual Instrument and its bound Impression."
          summaryTitle="How it works"
          summary={expandedInstrument.description}
          expandedContent={expandedInstrument.expandedContent}
          imageUrl={expandedInstrument.imageUrl}
          imageAlt={expandedInstrument.name}
          icon={Sparkles}
          canEdit={isDmMode}
          onSave={(data) =>
            saveEnhancedContent.mutateAsync({
              instrumentId: expandedInstrument.id,
              data,
            })
          }
        />
      )}
    </div>
  );
}

function InstrumentCard({
  instrument,
  characters,
  isDmMode,
  onOpenContent,
  onAssign,
  onEdit,
  onDelete,
}: {
  instrument: SpiritualInstrumentWithAssignments;
  characters: Character[];
  isDmMode: boolean;
  onOpenContent: () => void;
  onAssign: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const assigned = characters.filter((character) => instrument.characterIds.includes(character.id));
  return (
    <article
      className="wuxia-card cursor-pointer overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557d6f] focus-visible:ring-offset-2"
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${instrument.name}`}
      onClick={onOpenContent}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenContent();
        }
      }}
    >
      {instrument.imageUrl ? (
        <img src={instrument.imageUrl} alt="" className="h-48 w-full object-cover" />
      ) : (
        <div className="flex h-32 items-center justify-center bg-[#e7e0d1]/60 dark:bg-white/[0.04]">
          <Sparkles className="h-8 w-8 text-[#8d6b40]/70" />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl text-[#283f37] dark:text-[#eee3ce]">{instrument.name}</h3>
          {!instrument.isRevealed && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              <EyeOff className="mr-1 h-3 w-3" /> Hidden
            </span>
          )}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5f665f] dark:text-[#b7aa90]">{instrument.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {assigned.length ? assigned.map((character) => (
            <span key={character.id} className="rounded-full border border-[#9daf9f] bg-[#e4eee5] px-2.5 py-1 text-xs font-semibold text-[#31584c] dark:border-[#658477] dark:bg-[#31584c]/30 dark:text-[#dce9df]">
              {character.name}
            </span>
          )) : <span className="text-xs italic text-muted-foreground">Unassigned</span>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={onAssign}><Users className="mr-2 h-3.5 w-3.5" /> Assign</Button>
          {isDmMode && (
            <>
            <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="mr-2 h-3.5 w-3.5" /> Remove</Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
