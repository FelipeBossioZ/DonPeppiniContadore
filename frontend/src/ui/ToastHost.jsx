// frontend/src/ui/ToastHost.jsx
import { useEffect, useState } from "react";

export function toast(msg, type="info") {
  window.dispatchEvent(new CustomEvent("toast", { detail: { msg, type }}));
}

export default function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const h = (e) => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, ...e.detail }]);
      setTimeout(() => setItems((xs) => xs.filter((i) => i.id !== id)), 3000);
    };
    window.addEventListener("toast", h);
    return () => window.removeEventListener("toast", h);
  }, []);
  return (
    <div className="fixed top-3 right-3 z-[9999] space-y-2">
      {items.map((i) => (
        <div key={i.id}
          className={`px-3 py-2 rounded shadow text-sm border
                      ${i.type === "error" ? "bg-red-50 text-red-700 border-red-200"
                                           : "bg-slate-900 text-white border-slate-700"}`}>
          {i.msg}
        </div>
      ))}
    </div>
  );
}
