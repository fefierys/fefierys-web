import Link from "next/link";

interface CommissionViewToggleProps {
  activeView: "list" | "board";
}

const views = [
  {
    id: "list",
    label: "List",
    href: "/admin/commissions",
  },
  {
    id: "board",
    label: "Board",
    href: "/admin/commissions/kanban",
  },
] as const;

export default function CommissionViewToggle({
  activeView,
}: CommissionViewToggleProps) {
  return (
    <nav
      aria-label="Commission view"
      className="inline-flex rounded-xl border border-white/15 bg-white/5 p-1"
    >
      {views.map((view) => {
        const active = view.id === activeView;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              active
                ? "bg-white/15 text-white"
                : "text-white/55 hover:bg-white/10 hover:text-white"
            }`}
            href={view.href}
            key={view.id}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
