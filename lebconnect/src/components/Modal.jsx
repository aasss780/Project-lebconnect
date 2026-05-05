import { AnimatePresence, motion } from "framer-motion";

import { LC_EASE } from "../utils/motionProps";

export default function Modal({
  open,
  title,
  children,
  onClose,
  /** Wider panels for structured forms */
  wide = false,
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="lc-modal-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
        >
          <motion.div
            className={`lc-modal-panel${wide ? " lc-modal-panel--wide" : ""}`}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.32, ease: LC_EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lc-modal-head">
              <h3>{title}</h3>
              <button type="button" className="lc-modal-close" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </div>
            <div className="lc-modal-body">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
