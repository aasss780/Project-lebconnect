/** Consistent easing / motion for Framer Motion across LebConnect */
export const LC_EASE = [0.16, 1, 0.3, 1];

/** Page shell: subtle fade + rise */
export function lcMotionPage(y = 16) {
  return {
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: LC_EASE },
  };
}

/** Stagger hero stats / cards */
export const LC_STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
};

export const LC_STAGGER_ITEM = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.46, ease: LC_EASE },
  },
};
