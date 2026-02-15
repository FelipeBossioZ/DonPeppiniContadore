// 🎩 Don Peppini - Modal reutilizable
export default function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className={`bg-white ${wide ? "w-[98vw] max-w-6xl" : "w-[95vw] max-w-4xl"} rounded-xl shadow-xl max-h-[90vh] flex flex-col`}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button className="text-gray-500" onClick={onClose}>×</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-4 py-3 border-t shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
