import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, CheckCircle2, Clock, MapPin, ArrowLeft } from "lucide-react";
import { getOrderStatus, type OrderStatusResult } from "@/lib/api";
import { OrderCodeCard } from "@/components/OrderCodeCard";
import logo from "@/assets/localxpress-logo.jpeg";

type PollingState = "confirming" | "paid" | "timeout";

const PACKAGE_LABELS: Record<string, string> = {
  small:    "Pequeño",
  medium:   "Mediano",
  large:    "Grande",
  delicate: "Delicado",
};

function formatDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

const Success = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");

  const [pollingState, setPollingState] = useState<PollingState>("confirming");
  const [order, setOrder] = useState<OrderStatusResult | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setPollingState("timeout");
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      try {
        const result = await getOrderStatus(sessionId);
        if (result.payment_status === "paid") {
          setOrder(result);
          setPollingState("paid");
          return;
        }
      } catch {
        // network error — keep polling
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000);
      } else {
        setPollingState("timeout");
      }
    };

    poll();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col">
      <header className="bg-card/80 backdrop-blur-sm border-b border-border py-4 px-4">
        <div className="max-w-4xl mx-auto flex justify-center">
          <img src={logo} alt="LocalXpress" className="h-14 w-auto object-contain" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {/* ─── Confirming ─────────────────────────────────────────────────── */}
        {pollingState === "confirming" && (
          <Card className="max-w-lg w-full shadow-lg border-2 border-border/50">
            <CardContent className="pt-12 pb-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Confirmando tu pago…</h1>
                <p className="text-muted-foreground">
                  Estamos registrando tu pedido. Esto solo tarda unos segundos.
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Paid ───────────────────────────────────────────────────────── */}
        {pollingState === "paid" && order && (
          <Card className="max-w-lg w-full shadow-lg border-2 border-primary/30">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border/50 pb-4">
              <div className="flex justify-center mb-3">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-center text-xl text-foreground">
                ¡Pedido confirmado!
              </CardTitle>
              <p className="text-center text-sm text-muted-foreground mt-1">
                Hola <strong>{order.client_name}</strong>, hemos recibido tu pago.
                Recibirás un email de confirmación en breve.
              </p>
            </CardHeader>

            <CardContent className="pt-6 space-y-4">
              {/* Order code — only shown when present (new orders have it, old test orders may not) */}
              {order.order_code && <OrderCodeCard code={order.order_code} />}

              <div className="space-y-3">
                <div className="flex gap-3">
                  <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recogida</p>
                    <p className="text-sm font-medium">{order.pickup_address}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Truck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Entrega</p>
                    <p className="text-sm font-medium">{order.delivery_address}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cuándo</p>
                    <p className="text-sm font-medium">
                      {formatDate(order.scheduled_date ?? "")} · {order.scheduled_time}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{order.zone_name}</span>
                <span className="text-2xl font-bold text-primary">
                  {order.price !== null && order.price !== undefined
                    ? `${order.price} €`
                    : "—"}
                </span>
              </div>

              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4" />
                Hacer otro pedido
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── Timeout / no session ───────────────────────────────────────── */}
        {pollingState === "timeout" && (
          <Card className="max-w-lg w-full shadow-lg border-2 border-border/50">
            <CardContent className="pt-12 pb-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">¡Gracias por tu compra!</h1>
                <p className="text-muted-foreground">
                  Tu pago se está procesando. Recibirás un correo de confirmación en breve
                  con todos los detalles de tu pedido.
                </p>
              </div>
              <Button
                size="lg"
                className="font-semibold gap-2"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Success;
