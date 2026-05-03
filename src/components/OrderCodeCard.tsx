import { Hash } from "lucide-react";

interface OrderCodeCardProps {
  code: string;
}

export function OrderCodeCard({ code }: OrderCodeCardProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-border/50 shadow-sm">
      {/* Accent strip */}
      <div className="h-[3px] bg-gradient-to-r from-primary via-primary/80 to-primary/40" />

      <div className="bg-card px-5 py-4">
        {/* Label row */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <Hash className="w-3.5 h-3.5 text-primary/60 shrink-0" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Código de pedido
          </p>
        </div>

        {/* Code — mono, large, high contrast */}
        <p className="font-mono text-[22px] leading-none font-bold text-foreground tracking-[0.12em]">
          {code}
        </p>

        {/* Micro hint */}
        <p className="text-[11px] text-muted-foreground/60 mt-2 leading-snug">
          Guárdalo para cualquier consulta
        </p>
      </div>
    </div>
  );
}
