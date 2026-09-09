import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type HTMLAttributes,
} from "react";

export const SectionSaveContext = createContext<() => void>(() => {});

export function SectionSaveProvider({
  save,
  ...props
}: HTMLAttributes<HTMLDivElement> & { save: () => void }) {
  return (
    <SectionSaveContext.Provider value={save}>
      <div {...props} />
    </SectionSaveContext.Provider>
  );
}

/** Leaving a section saves once; moving among its fields doesn't. */
export function SaveSection(props: HTMLAttributes<HTMLDivElement>) {
  const save = useContext(SectionSaveContext);
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef(save);
  latest.current = save;
  useEffect(() => () => latest.current(), []);
  useEffect(() => {
    const leave = (event: PointerEvent) => {
      const section = element.current;
      if (
        section &&
        document.activeElement?.closest("[data-save-section]") === section &&
        !section.contains(event.target as Node)
      )
        latest.current();
    };
    document.addEventListener("pointerdown", leave);
    return () => document.removeEventListener("pointerdown", leave);
  }, []);
  return (
    <div
      {...props}
      ref={element}
      data-save-section=""
      onBlur={(event) => {
        props.onBlur?.(event);
        const target = event.target as HTMLElement;
        if (target.closest("[data-save-section]") !== event.currentTarget)
          return;
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          save();
      }}
    />
  );
}
