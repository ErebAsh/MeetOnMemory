import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

const SECTIONS = [
  { id: "hero", label: "Home" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "about", label: "About" },
  { id: "faq", label: "FAQ" },
];

export default function ScrollNavigator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(true);

  const hideTimeoutRef = useRef(null);
  const isLockActive = useRef(false);
  const lockTimeoutRef = useRef(null);
  const panelRef = useRef(null);
  const frameRef = useRef(null);

  // Drag-to-scroll tracking refs
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const scrollStartY = useRef(0);
  const isHyperScroll = useRef(false);

  const getSectionElement = (id) => {
    return (
      document.getElementById(id) ||
      document.getElementById(id.replace(/-/g, "")) ||
      document.getElementById(id.replace(/([A-Z])/g, "-$1").toLowerCase())
    );
  };

  // Linear Element Navigation (With Dynamic Header Height Calculations)
  const scrollToSectionIndex = useCallback((targetIndex) => {
    if (targetIndex < 0 || targetIndex >= SECTIONS.length) return;

    isLockActive.current = true;
    setCurrentIndex(targetIndex);

    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);

    const totalScrollableHeight =
      document.documentElement.scrollHeight - window.innerHeight;

    if (targetIndex === 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (targetIndex === SECTIONS.length - 1) {
      window.scrollTo({ top: totalScrollableHeight, behavior: "smooth" });
    } else {
      const targetSection = SECTIONS[targetIndex];
      const el = getSectionElement(targetSection.id);

      if (el) {
        const headerElement =
          document.querySelector("header") || document.querySelector("nav");
        const headerHeight = headerElement ? headerElement.offsetHeight : 0;

        const elementTopPosition =
          el.getBoundingClientRect().top + window.scrollY;
        const finalOffsetPosition = elementTopPosition - headerHeight;

        window.scrollTo({
          top: Math.min(
            totalScrollableHeight,
            Math.max(0, finalOffsetPosition),
          ),
          behavior: "smooth",
        });
      }
    }

    lockTimeoutRef.current = setTimeout(() => {
      isLockActive.current = false;
    }, 1200);
  }, []);

  // Core Window Observers & Maximum Visibility Area Engine
  useEffect(() => {
    const recalculateActiveSection = () => {
      if (isLockActive.current) return;

      const viewportHeight = window.innerHeight;
      const scrollPosition = window.scrollY;
      const totalScrollableHeight =
        document.documentElement.scrollHeight - viewportHeight;

      if (scrollPosition <= 5) {
        setCurrentIndex(0);
        return;
      }
      if (scrollPosition >= totalScrollableHeight - 5) {
        setCurrentIndex(SECTIONS.length - 1);
        return;
      }

      let maxVisibleHeight = 0;
      let detectedIndex = 0;

      for (let i = 0; i < SECTIONS.length; i++) {
        const el = getSectionElement(SECTIONS[i].id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);
        const visibleHeight = visibleBottom - visibleTop;

        if (visibleHeight > maxVisibleHeight) {
          maxVisibleHeight = visibleHeight;
          detectedIndex = i;
        }
      }

      setCurrentIndex(detectedIndex);
    };

    const onScroll = () => {
      setIsVisible(window.scrollY > window.innerHeight * 0.15);
      setIsUserScrolling(true);

      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 1500);

      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(recalculateActiveSection);
    };

    const onKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      // Safe side-effect management out of state mutation blocks
      if (["ArrowDown", "PageDown", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setCurrentIndex((prevIndex) => {
          let nextIndex = prevIndex;
          if (e.key === "ArrowDown" || e.key === "PageDown") {
            nextIndex = Math.min(SECTIONS.length - 1, prevIndex + 1);
          } else {
            nextIndex = Math.max(0, prevIndex - 1);
          }
          if (nextIndex !== prevIndex) {
            scrollToSectionIndex(nextIndex);
          }
          return nextIndex;
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    recalculateActiveSection();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scrollToSectionIndex]);

  const handleNext = (e) => {
    e.stopPropagation();
    if (currentIndex < SECTIONS.length - 1)
      scrollToSectionIndex(currentIndex + 1);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) scrollToSectionIndex(currentIndex - 1);
  };

  // Fluid Drag Mechanics
  const handleMouseDown = (e) => {
    if (e.target.closest("button")) return;

    isDragging.current = true;
    isHyperScroll.current = e.detail === 2;

    dragStartPos.current = { x: e.clientX, y: e.clientY };
    scrollStartY.current = window.scrollY;

    if (panelRef.current) {
      panelRef.current.style.cursor = "grabbing";
      panelRef.current.style.transform = "scale(1.02)";
    }
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();

    const isMobile = window.innerWidth < 768;
    // Calculate vector delta based on layout orientation
    const delta = isMobile
      ? e.clientX - dragStartPos.current.x
      : e.clientY - dragStartPos.current.y;

    const totalScrollableHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const multiplier = isHyperScroll.current
      ? 4.5
      : totalScrollableHeight / (window.innerHeight * 0.4);

    const targetScroll = scrollStartY.current + delta * multiplier;
    window.scrollTo({
      top: Math.max(0, Math.min(totalScrollableHeight, targetScroll)),
      behavior: "auto",
    });
  };

  const handleMouseUpOrLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    isHyperScroll.current = false;

    if (panelRef.current) {
      panelRef.current.style.cursor = "pointer";
      panelRef.current.style.transform = "scale(1)";
    }
    document.body.style.userSelect = "";
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-[999] max-md:right-0 max-md:left-0 max-md:bottom-4 max-md:px-4 flex justify-center items-center pointer-events-none transition-all duration-300 transform ${
        isUserScrolling ? "opacity-100 scale-100" : "opacity-40 scale-95"
      }`}
    >
      <div
        ref={panelRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="pointer-events-auto flex md:flex-col items-center bg-zinc-950/80 backdrop-blur-2xl border border-zinc-800/80 rounded-full md:p-2 shadow-2xl text-white max-md:px-4 max-md:py-2 max-md:gap-4 max-md:w-full max-md:max-w-md max-md:justify-between select-none touch-none will-change-transform transition-transform duration-200"
        style={{ cursor: "pointer" }}
      >
        {/* Arrow Up */}
        <button
          onClick={handlePrev}
          disabled={currentIndex <= 0}
          className="p-2 rounded-full hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-all disabled:opacity-10 disabled:pointer-events-none active:scale-90 cursor-pointer select-none"
          title="Previous Section"
          aria-label="Scroll to previous section"
        >
          <ChevronUp size={18} className="max-md:-rotate-90" />
        </button>

        {/* Desktop Dots Matrix */}
        <div className="hidden md:flex flex-col gap-4 my-4 px-1.5 pointer-events-none">
          {SECTIONS.map((sec, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={sec.id}
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToSectionIndex(index);
                }}
                className="relative group flex items-center justify-center cursor-pointer p-1 pointer-events-auto"
                aria-label={`Scroll to ${sec.label}`}
              >
                {/* Tooltip Label */}
                <span className="absolute right-8 bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs px-2.5 py-1 rounded-md opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none transition-all duration-150 whitespace-nowrap shadow-xl">
                  {sec.label}
                </span>

                {/* Circle Element */}
                <div className="w-3 h-3 flex items-center justify-center">
                  <div
                    className={`rounded-full transition-all duration-200 will-change-transform ${
                      isActive
                        ? "w-2.5 h-2.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                        : "w-1.5 h-1.5 bg-zinc-600 group-hover:bg-zinc-400 scale-100 group-hover:scale-110"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile View Title Card */}
        <div className="md:hidden flex items-center gap-2 select-none pointer-events-none">
          <span className="text-xs tracking-wider text-zinc-500 uppercase font-mono">
            Section
          </span>
          <span className="text-xs font-semibold bg-zinc-800/50 text-zinc-200 px-3 py-1 rounded-md border border-zinc-700/30 min-w-[110px] text-center">
            {SECTIONS[currentIndex]?.label || "Loading..."}
          </span>
        </div>

        {/* Arrow Down */}
        <button
          onClick={handleNext}
          disabled={currentIndex >= SECTIONS.length - 1}
          className="p-2 rounded-full hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-all disabled:opacity-10 disabled:pointer-events-none active:scale-90 cursor-pointer select-none"
          title="Next Section"
          aria-label="Scroll to next section"
        >
          <ChevronDown size={18} className="max-md:-rotate-90" />
        </button>
      </div>
    </div>
  );
}
