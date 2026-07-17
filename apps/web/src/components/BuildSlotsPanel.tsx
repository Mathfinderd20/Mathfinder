interface SavedBuildSlotView {
  id: string;
  label: string;
  savedAt: string;
}

interface BuildSlotsPanelProps {
  savedBuildSlots: SavedBuildSlotView[];
  onSaveNewBuildSlot: () => void;
  onResetCurrentBuild: () => void;
  onLoadBuildSlot: (slotId: string) => void;
  onOverwriteBuildSlot: (slotId: string) => void;
  onDeleteBuildSlot: (slotId: string) => void;
}

export function BuildSlotsPanel({
  savedBuildSlots,
  onSaveNewBuildSlot,
  onResetCurrentBuild,
  onLoadBuildSlot,
  onOverwriteBuildSlot,
  onDeleteBuildSlot,
}: BuildSlotsPanelProps) {
  return (
    <section className="panel">
      <h2>Character Saves</h2>
      <p className="hint">
        Current build autosaves. Slots keep multiple characters handy.
      </p>
      <div className="save-actions">
        <button className="ghost small" onClick={onSaveNewBuildSlot}>
          Save New Slot
        </button>
        <button className="ghost small" onClick={onResetCurrentBuild}>
          Reset Current
        </button>
      </div>
      <div className="slot-list">
        {savedBuildSlots.length === 0 ? (
          <p className="hint">No saved slots yet. Shocking restraint.</p>
        ) : (
          savedBuildSlots.map((slot) => (
            <div className="slot-row" key={slot.id}>
              <div className="slot-meta">
                <strong>{slot.label}</strong>
                <span className="buff-desc">
                  {new Date(slot.savedAt).toLocaleString()}
                </span>
              </div>
              <div className="resource-buttons">
                <button
                  className="ghost small"
                  onClick={() => onLoadBuildSlot(slot.id)}
                >
                  Load
                </button>
                <button
                  className="ghost small"
                  onClick={() => onOverwriteBuildSlot(slot.id)}
                >
                  Overwrite
                </button>
                <button
                  className="ghost small"
                  onClick={() => onDeleteBuildSlot(slot.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
