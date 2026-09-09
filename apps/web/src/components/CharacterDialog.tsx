import { useContext, useEffect, useRef, type ReactNode } from "react";
import { SectionSaveContext } from "./SaveSection";

/** Native top-layer dialogs avoid sticky rails/headers clipping the overlay. */
export function CharacterDialog({
  label,
  onClose,
  children,
  saveOnExit = false,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  saveOnExit?: boolean;
}) {
  const save = useContext(SectionSaveContext);
  const latestSave = useRef(save);
  latestSave.current = save;
  useEffect(
    () => () => {
      if (saveOnExit) latestSave.current();
    },
    [saveOnExit],
  );
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal-backdrop character-dialog-backdrop"
      aria-label={label}
      data-save-section={saveOnExit ? "" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
