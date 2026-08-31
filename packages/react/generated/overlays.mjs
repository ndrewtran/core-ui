// @generated-from: packages/react/src/overlays.mjs
// @generated-content-sha256: sha256:77bba905c0c9f58cd8bd0575d5739c834e9037d191502efef8e333de258112d7
import React from 'react';
import XIcon from 'lucide-react/dist/esm/icons/x.mjs';
import { Button as MuxUIButton } from './button.mjs';
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  DropZone as AriaDropZone,
  FileTrigger as AriaFileTrigger,
  Heading as AriaHeading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  Popover as AriaPopover,
  Pressable as AriaPressable,
  PreviewTrigger as AriaPreviewTrigger,
  Text as AriaText,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastQueue,
  UNSTABLE_ToastRegion,
} from 'react-aria-components';

function classNames(base, className) {
  return [base, className].filter(Boolean).join(' ');
}

function normalizeMaxVisible(value) {
  const normalized = Number.isFinite(value) ? Math.floor(value) : 5;
  return normalized > 0 ? normalized : 5;
}

function hasRenderableLabel(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return true;
  if (value === undefined || value === null || typeof value === 'boolean') return false;
  if (Array.isArray(value)) return value.some(hasRenderableLabel);
  if (React.isValidElement(value)) {
    if (value.type === React.Fragment) return hasRenderableLabel(value.props.children);
    // Custom React elements are opaque until React renders them; browser accessibility validation owns their output.
    if (typeof value.type !== 'string') return true;
    if (hasAccessibleName(value.props['aria-label']) || hasAccessibleName(value.props['aria-labelledby']) || hasAccessibleName(value.props.title)) return true;
    return hasRenderableLabel(value.props.children);
  }
  return true;
}

function hasAccessibleName(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fileList(files) {
  return files ? [...files] : [];
}

function normalizeDropItem(item) {
  const normalized = { kind: item.kind };
  if (item.name !== undefined) normalized.name = item.name;
  if (item.type !== undefined) normalized.type = item.type;
  if (item.types !== undefined) normalized.types = new Set(item.types);
  if (typeof item.getFile === 'function') normalized.getFile = item.getFile.bind(item);
  if (typeof item.getText === 'function') normalized.getText = item.getText.bind(item);
  if (typeof item.getEntries === 'function') {
    normalized.getEntries = async function* getEntries() {
      for await (const child of item.getEntries()) yield normalizeDropItem(child);
    };
  }
  return normalized;
}

function normalizeDropEvent(event) {
  return {
    type: 'drop',
    x: event.x,
    y: event.y,
    dropOperation: event.dropOperation,
    items: event.items.map(normalizeDropItem),
  };
}

function pressableTrigger(trigger, disabled = false, className) {
  if (!React.isValidElement(trigger)) return trigger;
  const normalizedTrigger = className
    ? React.cloneElement(trigger, { className: classNames(trigger.props.className, className) })
    : trigger;
  // RAC trigger components (including MuxUI Button) consume DialogTrigger's
  // PressResponder context directly. Wrapping them in a second Pressable
  // shadows that context and prevents keyboard-triggered opening.
  if (typeof trigger.type !== 'string') return normalizedTrigger;
  return React.createElement(AriaPressable, { isDisabled: disabled }, normalizedTrigger);
}

/**
 * MuxUI owns the public callback shape while RAC owns drop, clipboard, hover, and focus semantics.
 */
export const DropZone = React.forwardRef(function DropZone({
  children = 'Drop files here',
  disabled = false,
  onDrop,
  onActivate,
  className,
  ...props
}, ref) {
  const handleDrop = React.useCallback((event) => {
    onDrop?.(normalizeDropEvent(event));
  }, [onDrop]);
  const handleDropActivate = React.useCallback((event) => {
    onActivate?.({ type: 'activate', x: event.x, y: event.y });
  }, [onActivate]);
  const assignDropZoneRef = React.useCallback((node) => {
    if (node) {
      if (disabled) node.setAttribute('aria-disabled', 'true');
      else node.removeAttribute('aria-disabled');
    }
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [disabled, ref]);
  return React.createElement(AriaDropZone, {
    ...props,
    ref: assignDropZoneRef,
    isDisabled: disabled,
    onDrop: handleDrop,
    onDropActivate: handleDropActivate,
    className: classNames('muxui-drop-zone', className),
  }, children);
});

DropZone.displayName = 'DropZone';

/** RAC resets the native input before each press, preserving same-file selection behavior. */
export const FileTrigger = React.forwardRef(function FileTrigger({
  children = 'Choose files',
  acceptedFileTypes,
  allowsMultiple = false,
  acceptDirectory = false,
  defaultCamera,
  disabled = false,
  onSelect,
  className,
  ...props
}, ref) {
  const trigger = React.isValidElement(children)
    ? React.cloneElement(children, { className: classNames('muxui-file-trigger', classNames(children.props.className, className)), disabled: disabled || children.props.disabled, 'aria-disabled': disabled || undefined })
    : React.createElement(MuxUIButton, { className: classNames('muxui-file-trigger', className), disabled }, children);
  return React.createElement(AriaFileTrigger, {
    ...props,
    ref,
    acceptedFileTypes,
    allowsMultiple,
    defaultCamera,
    acceptDirectory,
    onSelect: (files) => onSelect?.(fileList(files)),
  }, pressableTrigger(trigger, disabled));
});

FileTrigger.displayName = 'FileTrigger';

function DialogContent({ title, children, ariaLabel, dismissable, className, contentRef, ...props }) {
  return React.createElement(AriaDialog, { ...props, ref: contentRef, className: classNames('muxui-dialog', className), 'aria-label': ariaLabel, 'aria-modal': 'true' },
    hasRenderableLabel(title) ? React.createElement(AriaHeading, { slot: 'title', className: 'muxui-dialog-title' }, title) : null,
    React.createElement('div', { className: 'muxui-dialog-content' }, children),
    dismissable ? React.createElement(AriaButton, { slot: 'close', className: 'muxui-dialog-close', 'aria-label': 'Close dialog' }, React.createElement(XIcon, { 'aria-hidden': 'true', focusable: 'false', size: 16 })) : null);
}

function DialogOverlay({ dismissable, children, ...props }) {
  return React.createElement(AriaModalOverlay, {
    ...props,
    isDismissable: dismissable,
    isKeyboardDismissDisabled: !dismissable,
    className: 'muxui-dialog-backdrop',
  }, React.createElement(AriaModal, { className: 'muxui-dialog-modal' }, children));
}

/** RAC Modal/ModalOverlay provide topmost overlay arbitration, inertness, focus scope, and portal lifecycle. */
export const Dialog = React.forwardRef(function Dialog({
  children,
  title,
  open,
  defaultOpen = false,
  dismissable = true,
  trigger,
  onOpenChange,
  className,
  'aria-label': ariaLabel,
  ...props
}, ref) {
  const hasTitle = hasRenderableLabel(title);
  if (!hasTitle && !hasAccessibleName(ariaLabel) && !hasAccessibleName(props['aria-labelledby'])) throw new Error('Dialog requires a title or accessible name');
  const content = React.createElement(DialogOverlay, { dismissable },
    React.createElement(DialogContent, { ...props, contentRef: ref, title, ariaLabel, dismissable, className }, children));
  if (React.isValidElement(trigger)) {
    return React.createElement(AriaDialogTrigger, { isOpen: open, defaultOpen, onOpenChange }, pressableTrigger(trigger, false, 'muxui-dialog-trigger'), content);
  }
  return React.createElement(AriaModalOverlay, {
    isOpen: open,
    defaultOpen,
    onOpenChange,
    isDismissable: dismissable,
    isKeyboardDismissDisabled: !dismissable,
    className: 'muxui-dialog-backdrop',
  }, React.createElement(AriaModal, { className: 'muxui-dialog-modal' }, React.createElement(DialogContent, { ...props, contentRef: ref, title, ariaLabel, dismissable, className }, children)));
});

Dialog.displayName = 'Dialog';

const PopupContent = React.forwardRef(function PopupContent({ children, className, placement, dismissable, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...props }, ref) {
  return React.createElement(AriaPopover, {
    ...props,
    ref,
    placement,
    className: 'muxui-popover-positioner',
    isKeyboardDismissDisabled: !dismissable,
    shouldCloseOnInteractOutside: dismissable ? undefined : () => false,
  }, React.createElement(AriaDialog, {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    className: classNames('muxui-popover', className),
  }, children));
});

/** RAC Popover owns positioning, outside interaction, topmost dismissal, and modal focus behavior. */
export const Popover = React.forwardRef(function Popover({
  children,
  trigger,
  open,
  defaultOpen = false,
  dismissable = true,
  placement = 'bottom',
  onOpenChange,
  className,
  ...props
}, ref) {
  if (!React.isValidElement(trigger)) throw new Error('Popover requires a focusable React element as trigger');
  if (!hasAccessibleName(props['aria-label']) && !hasAccessibleName(props['aria-labelledby'])) throw new Error('Popover requires an accessible name');
  const content = React.createElement(PopupContent, { ...props, ref, placement, className, dismissable }, children);
  return React.createElement(AriaDialogTrigger, { isOpen: open, defaultOpen, onOpenChange }, pressableTrigger(trigger, false, 'muxui-overlay-pop-trigger'), content);
});

Popover.displayName = 'Popover';

const PreviewContent = React.forwardRef(function PreviewContent({ children, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, ref) {
  return React.createElement(AriaDialog, {
    ref,
    className: 'muxui-preview-content',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
  }, children);
});

/** RAC PreviewTrigger owns long press, warmup/cooldown timers, focus, Escape, and safe-area positioning. */
export const PreviewTrigger = React.forwardRef(function PreviewTrigger({
  children,
  trigger,
  delay = 600,
  closeDelay = 200,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = 'top',
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  ...props
}, ref) {
  if (!React.isValidElement(trigger)) throw new Error('PreviewTrigger requires a focusable React element as trigger');
  if (!hasAccessibleName(ariaLabel) && !hasAccessibleName(ariaLabelledby)) throw new Error('PreviewTrigger requires an accessible name');
  return React.createElement(AriaPreviewTrigger, { delay, closeDelay, isOpen: open, defaultOpen, onOpenChange },
    pressableTrigger(trigger),
    React.createElement(AriaPopover, { ...props, ref, isNonModal: true, trigger: 'PreviewTrigger', placement, className: classNames('muxui-preview-trigger', className) },
      React.createElement(PreviewContent, { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, children)));
});

PreviewTrigger.displayName = 'PreviewTrigger';

/** RAC TooltipTrigger owns global hover/focus timing and keyboard modality semantics. */
export const Tooltip = React.forwardRef(function Tooltip({
  content,
  trigger,
  delay = 500,
  closeDelay = 0,
  placement = 'top',
  open,
  defaultOpen = false,
  onOpenChange,
  className,
  ...props
}, ref) {
  if (!React.isValidElement(trigger)) throw new Error('Tooltip requires a focusable React element as trigger');
  if (!hasRenderableLabel(content)) throw new Error('Tooltip requires content');
  return React.createElement(AriaTooltipTrigger, {
    delay,
    closeDelay,
    isOpen: open,
    defaultOpen,
    onOpenChange,
  }, pressableTrigger(trigger), React.createElement(AriaTooltip, { ...props, ref, placement, className: classNames('muxui-tooltip', className) }, content));
});

Tooltip.displayName = 'Tooltip';

const ToastContext = React.createContext(null);
const TOAST_FALLBACK_TITLE = 'Notification';

function ToastView({ toast }) {
  const value = toast.content;
  const hasTitle = hasRenderableLabel(value.title);
  return React.createElement(AriaToast, { toast, className: classNames('muxui-toast', value.className), 'data-variant': value.variant },
    React.createElement(AriaToastContent, { className: 'muxui-toast-content' },
      React.createElement(AriaText, { slot: 'title', className: classNames('muxui-toast-title', !hasTitle && 'muxui-toast-title-fallback') }, hasTitle ? value.title : TOAST_FALLBACK_TITLE),
      React.createElement(AriaText, { slot: 'description', className: 'muxui-toast-message' }, value.message)),
    React.createElement(AriaButton, { slot: 'close', className: 'muxui-toast-dismiss', 'aria-label': 'Dismiss notification' }, React.createElement(XIcon, { 'aria-hidden': 'true', focusable: 'false', size: 16 })));
}

/** Stable MuxUI facade over RAC's unstable queue/region implementation. */
export const ToastProvider = function ToastProvider({ children, maxVisible = 5, className, placement = 'top-end' }) {
  const queueRef = React.useRef(null);
  if (!queueRef.current) queueRef.current = new UNSTABLE_ToastQueue({ maxVisibleToasts: normalizeMaxVisible(maxVisible) });
  const queue = queueRef.current;
  const callbacksRef = React.useRef(new Map());
  const notifyDismissed = React.useCallback((key) => {
    if (!callbacksRef.current.has(key)) return;
    const callback = callbacksRef.current.get(key);
    callbacksRef.current.delete(key);
    callback?.();
  }, []);
  const add = React.useCallback((message, options = {}) => {
    if (!hasRenderableLabel(message)) throw new Error('Toast requires a message');
    const { duration, onDismiss, ...content } = options;
    let key;
    key = queue.add({ ...content, message }, {
      timeout: duration ?? 5000,
      onClose: () => notifyDismissed(key),
    });
    callbacksRef.current.set(key, onDismiss);
    return key;
  }, [notifyDismissed, queue]);
  const remove = React.useCallback((id) => queue.close(id), [queue]);
  const dispose = React.useCallback((id, settle = true) => {
    queue.visibleToasts.find((toast) => toast.key === id)?.timer?.pause();
    if (!settle) callbacksRef.current.delete(id);
    queue.close(id);
  }, [queue]);
  const lifecycleRef = React.useRef(0);
  React.useEffect(() => {
    const generation = ++lifecycleRef.current;
    return () => queueMicrotask(() => {
      if (lifecycleRef.current !== generation) return;
      queue.pauseAll();
      queue.clear();
      const callbacks = [...callbacksRef.current.values()];
      callbacksRef.current.clear();
      for (const callback of callbacks) callback?.();
    });
  }, [queue]);
  const manager = React.useMemo(() => ({ add, remove }), [add, remove]);
  const value = React.useMemo(() => ({ manager, dispose }), [dispose, manager]);
  return React.createElement(ToastContext.Provider, { value }, children,
    React.createElement(UNSTABLE_ToastRegion, { queue, placement, className: classNames('muxui-toast-region', className), 'aria-label': 'Notifications', 'data-placement': placement },
      ({ toast }) => React.createElement(ToastView, { toast })));
};

ToastProvider.displayName = 'ToastProvider';

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context.manager;
}

export const Toast = function Toast({
  message,
  title,
  variant = 'neutral',
  duration,
  onDismiss,
  className,
}) {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('Toast must be used within ToastProvider');
  if (!hasRenderableLabel(message)) throw new Error('Toast requires a message');
  const { add } = context.manager;
  const { dispose } = context;
  const keyRef = React.useRef(null);
  React.useEffect(() => {
    const key = add(message, {
      title,
      variant,
      duration,
      className,
      onDismiss,
    });
    keyRef.current = key;
    return () => queueMicrotask(() => {
      const isCurrent = keyRef.current === key;
      if (isCurrent) keyRef.current = null;
      dispose(key, isCurrent);
    });
  }, [add, dispose, message, title, variant, duration, onDismiss, className]);
  return null;
};

Toast.displayName = 'Toast';
