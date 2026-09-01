import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

interface Props {
  durationMs?: number;
  disabled?: boolean;
  onHoldStart?: () => void;
  onHoldCancel?: () => void;
  onComplete: () => void;
}

const DEFAULT_HOLD_DURATION_MS = 1250;

export function HoldToActivateButton({
  durationMs = DEFAULT_HOLD_DURATION_MS,
  disabled = false,
  onHoldStart,
  onHoldCancel,
  onComplete,
}: Props) {
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const holdingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const cancelHold = useCallback(() => {
    if (!holdingRef.current) return;
    clearTimer();
    holdingRef.current = false;
    setHolding(false);
    onHoldCancel?.();
  }, [clearTimer, onHoldCancel]);

  const startHold = useCallback(() => {
    if (disabled || holdingRef.current) return;
    holdingRef.current = true;
    setHolding(true);
    onHoldStart?.();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined;
      holdingRef.current = false;
      setHolding(false);
      onComplete();
    }, durationMs);
  }, [disabled, durationMs, onComplete, onHoldStart]);

  useEffect(
    () => () => {
      clearTimer();
    },
    [clearTimer],
  );

  useEffect(() => {
    if (disabled) cancelHold();
  }, [cancelHold, disabled]);

  useEffect(() => {
    function cancelInterruptedHold() {
      cancelHold();
    }
    function cancelHiddenHold() {
      if (document.hidden) cancelHold();
    }
    window.addEventListener("blur", cancelInterruptedHold);
    document.addEventListener("visibilitychange", cancelHiddenHold);
    return () => {
      window.removeEventListener("blur", cancelInterruptedHold);
      document.removeEventListener("visibilitychange", cancelHiddenHold);
    };
  }, [cancelHold]);

  return (
    <button
      type="button"
      className={`level-up-hold-button${holding ? " is-holding" : ""}`}
      disabled={disabled}
      aria-label={`Hold for ${durationMs / 1000} seconds to level up`}
      aria-describedby="level-up-hold-instructions"
      style={{ "--hold-duration": `${durationMs}ms` } as CSSProperties}
      onClick={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        startHold();
      }}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onLostPointerCapture={cancelHold}
      onKeyDown={(event) => {
        if (event.repeat || (event.key !== " " && event.key !== "Enter"))
          return;
        event.preventDefault();
        startHold();
      }}
      onKeyUp={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        cancelHold();
      }}
      onBlur={cancelHold}
    >
      <span className="level-up-hold-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle className="level-up-hold-track" cx="12" cy="12" r="9" />
          <circle className="level-up-hold-progress" cx="12" cy="12" r="9" />
          <path d="M12 16V8m0 0-3 3m3-3 3 3" />
        </svg>
      </span>
      <span>{holding ? "Keep Holding" : "Hold to Level Up"}</span>
      <span id="level-up-hold-instructions" className="sr-only">
        Continue holding until the level-up planner opens. Release to cancel.
      </span>
    </button>
  );
}
