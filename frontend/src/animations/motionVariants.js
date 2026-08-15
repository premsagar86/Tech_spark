// Shared Motion variants for React-state-driven transitions — modals, wizard
// steps, the scan-result banner, button hover/tap (Part 10).

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalPanel = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.95, y: 16, transition: { duration: 0.15 } },
};

export const stepSlide = {
  enter: { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: -24, transition: { duration: 0.2 } },
};

export const scanResultBanner = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, type: "spring", stiffness: 300, damping: 22 } },
};

export const buttonTap = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
};
