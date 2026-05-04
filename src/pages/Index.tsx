import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MapPin, User, Clock, Truck, Calculator, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getQuote, createCheckout, type QuoteResult, type QuotePayload } from "@/lib/api";
import logo from "@/assets/localxpress-logo.jpeg";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PACKAGE_SIZE_MAP: Record<string, "small" | "medium" | "large"> = {
  pequeno: "small",
  mediano: "medium",
  grande:  "large",
};

const PACKAGE_LABELS: Record<string, string> = {
  pequeno: "Pequeño",
  mediano: "Mediano",
  grande:  "Grande",
};

const SERVICE_TIME_BUFFER_MINUTES = 20;

function getTodayIso(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

const Index = () => {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [senderName, setSenderName]       = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [senderPhone, setSenderPhone]     = useState("");
  const [senderEmail, setSenderEmail]     = useState("");

  const [productType, setProductType]   = useState("");
  const [otherProduct, setOtherProduct] = useState("");
  const [productSize, setProductSize]   = useState("");
  const [isFragile, setIsFragile]       = useState("");

  const [recipientName, setRecipientName]       = useState("");
  const [recipientPhone, setRecipientPhone]     = useState("");
  const [deliveryAddress, setDeliveryAddress]   = useState("");

  const [timeSlot, setTimeSlot]         = useState("");
  const [specificDate, setSpecificDate] = useState("");
  const [specificTime, setSpecificTime] = useState("");
  const [notes, setNotes]               = useState("");

  // ── Coordinates from Google Places (null when typed manually) ───────────────
  const [pickupLat,   setPickupLat]   = useState<number | null>(null);
  const [pickupLng,   setPickupLng]   = useState<number | null>(null);
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);

  // ── Quote / checkout state ───────────────────────────────────────────────────
  const [quoteResult, setQuoteResult]           = useState<QuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote]     = useState(false);
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);

  // ─── Validation ───────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    if (!senderName || !pickupAddress || !senderPhone || !senderEmail) {
      toast.error("Completa todos los datos de quien solicita la recogida");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
      toast.error("Introduce un correo válido");
      return false;
    }
    if (senderPhone.replace(/\s/g, "").length < 9) {
      toast.error("El teléfono debe tener al menos 9 dígitos");
      return false;
    }
    if (!productType || !productSize || !isFragile) {
      toast.error("Completa la información del paquete");
      return false;
    }
    if (productType === "otro" && !otherProduct) {
      toast.error("Especifica el tipo de producto");
      return false;
    }
    if (!recipientName || !recipientPhone || !deliveryAddress) {
      toast.error("Completa los datos del destinatario");
      return false;
    }
    if (!timeSlot) {
      toast.error("Selecciona una franja horaria");
      return false;
    }
    if (timeSlot === "fecha-concreta" && (!specificDate || !specificTime)) {
      toast.error("Especifica la fecha y hora de entrega");
      return false;
    }
    return true;
  };

  // ─── Build API payload ────────────────────────────────────────────────────

  const buildPayload = (): QuotePayload => {
    const today = getTodayIso();

    let scheduled_date = today;
    let scheduled_time = "Lo antes posible";
    if (timeSlot === "hoy-manana") {
      scheduled_time = "Mañana (10:00-14:00)";
    } else if (timeSlot === "hoy-tarde") {
      scheduled_time = "Tarde (15:00-20:00)";
    } else if (timeSlot === "fecha-concreta") {
      scheduled_date = specificDate;
      scheduled_time = specificTime;
    }

    // Recipient and product info packed into notes (recipient identity
    // is now sent in dedicated fields and removed from here)
    const noteParts: string[] = [];
    const displayProduct = productType === "otro" ? otherProduct : productType;
    if (displayProduct) noteParts.push(`Producto: ${displayProduct}`);
    if (isFragile === "si") noteParts.push("¡FRÁGIL!");
    if (notes) noteParts.push(notes);

    return {
      // Recipient of the package
      client_name:        recipientName.trim(),
      client_phone:       recipientPhone.replace(/\s/g, ""),
      // Person placing / paying the order
      customer_full_name: senderName.trim(),
      customer_phone:     senderPhone.replace(/\s/g, ""),
      customer_email:     senderEmail.trim(),
      // Service
      pickup_address:     pickupAddress.trim(),
      delivery_address:   deliveryAddress.trim(),
      scheduled_date,
      scheduled_time,
      package_size:       PACKAGE_SIZE_MAP[productSize] ?? "small",
      client_notes:       noteParts.join(" | ") || undefined,
      ...(pickupLat   != null && pickupLng   != null ? { pickup_lat:   pickupLat,   pickup_lng:   pickupLng   } : {}),
      ...(deliveryLat != null && deliveryLng != null ? { delivery_lat: deliveryLat, delivery_lng: deliveryLng } : {}),
    };
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleGetQuote = async () => {
    if (!validateForm()) return;
    setQuoteResult(null);
    setIsLoadingQuote(true);
    try {
      const result = await getQuote(buildPayload());
      if (!result.ok) {
        const msg = result.details
          ? result.details.map((d) => d.message).join(", ")
          : (result.error ?? "Error al calcular el precio");
        toast.error(msg);
        return;
      }
      setQuoteResult(result);
      // Scroll to quote result
      setTimeout(() => {
        document.getElementById("quote-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      toast.error("No se pudo conectar con el servidor. ¿Está el backend en marcha?");
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleCheckout = async () => {
    if (!quoteResult?.ok || quoteResult.manual_quote_required) return;
    setIsLoadingCheckout(true);
    try {
      const result = await createCheckout(buildPayload());
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo iniciar el pago. Inténtalo de nuevo.");
        return;
      }
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      toast.error("Error al conectar con el servicio de pago.");
    } finally {
      setIsLoadingCheckout(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-x-hidden">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border py-4 md:py-8 px-3 md:px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center gap-1 md:gap-2">
            <img
              src={logo}
              alt="LocalXpress Logo"
              className="h-16 md:h-24 w-auto object-contain animate-fade-in"
            />
            <p className="text-muted-foreground text-center text-sm md:text-base">
              Pide un repartidor cuando quieras
            </p>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden pb-20 md:pb-24">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 animate-fade-in" />
        <div className="max-w-4xl mx-auto px-3 md:px-4 py-6 md:py-12 relative">
          <div className="text-center space-y-3 md:space-y-4 w-full">
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-semibold animate-scale-in">
                <Truck className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                <span>Reparto inmediato</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground animate-fade-in leading-tight px-2 max-w-full break-words">
              Solicita tu Recogida en <span className="whitespace-nowrap text-primary">1 minuto</span>            </h2>
          </div>
        </div>
      </section>

      {/* Form Section */}
      <section className="max-w-4xl mx-auto px-3 md:px-4 pb-8 md:pb-12 -mt-12 md:-mt-16 relative z-10">
        <div className="space-y-4 md:space-y-6">

          {/* Block 1: Sender */}
          <Card className="shadow-lg border-2 border-border/50 hover:border-primary/30 transition-all duration-300 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl">
                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                  <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <span>1. ¿Quién solicita la recogida?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4 px-4 md:px-6">
              <div>
                <Label htmlFor="senderName" className="text-sm md:text-base">Nombre y apellidos *</Label>
                <Input
                  id="senderName"
                  placeholder="Juan Pérez"
                  value={senderName}
                  onChange={(e) => { setSenderName(e.target.value); setQuoteResult(null); }}
                  className="h-11 md:h-10 text-base"
                />
              </div>
              <AddressAutocomplete
                id="pickupAddress"
                label="Dirección de recogida *"
                placeholder="C/ Ejemplo 123, 2ºA, Barcelona"
                value={pickupAddress}
                onChange={(v) => { setPickupAddress(v); setPickupLat(null); setPickupLng(null); setQuoteResult(null); }}
                onCoordinates={(lat, lng) => { setPickupLat(lat); setPickupLng(lng); }}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="senderPhone" className="text-sm md:text-base">Teléfono *</Label>
                  <Input
                    id="senderPhone"
                    type="tel"
                    placeholder="612 345 678"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="h-11 md:h-10 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="senderEmail" className="text-sm md:text-base">Correo electrónico *</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    placeholder="tucorreo@ejemplo.com"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="h-11 md:h-10 text-base"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Block 2: Product */}
          <Card className="shadow-lg border-2 border-border/50 hover:border-primary/30 transition-all duration-300 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl">
                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                  <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <span>2. ¿Qué tenemos que entregar?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                <div>
                  <Label htmlFor="productType" className="text-sm md:text-base">Tipo de producto *</Label>
                  <Select value={productType} onValueChange={(v) => { setProductType(v); setQuoteResult(null); }}>
                    <SelectTrigger id="productType" className="h-11 md:h-10 text-base">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flores">Flores</SelectItem>
                      <SelectItem value="pasteleria">Pastelería</SelectItem>
                      <SelectItem value="catering">Catering</SelectItem>
                      <SelectItem value="alimentacion">Alimentación</SelectItem>
                      <SelectItem value="farmacia">Farmacia / Parafarmacia</SelectItem>
                      <SelectItem value="regalos">Regalos</SelectItem>
                      <SelectItem value="paquete">Paquete</SelectItem>
                      <SelectItem value="documentacion">Documentos</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="productSize" className="text-sm md:text-base">Tamaño *</Label>
                  <Select value={productSize} onValueChange={(v) => { setProductSize(v); setQuoteResult(null); }}>
                    <SelectTrigger id="productSize" className="h-11 md:h-10 text-base">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pequeno">Pequeño</SelectItem>
                      <SelectItem value="mediano">Mediano</SelectItem>
                      <SelectItem value="grande">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-2 block text-sm md:text-base">¿Frágil? *</Label>
                  <RadioGroup value={isFragile} onValueChange={setIsFragile} className="flex gap-6">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="si" id="fragil-si" className="h-5 w-5" />
                      <Label htmlFor="fragil-si" className="font-normal cursor-pointer text-base">Sí</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="fragil-no" className="h-5 w-5" />
                      <Label htmlFor="fragil-no" className="font-normal cursor-pointer text-base">No</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
              {productType === "otro" && (
                <div className="mt-3 md:mt-4">
                  <Label htmlFor="otherProduct" className="text-sm md:text-base">Especifica el producto *</Label>
                  <Input
                    id="otherProduct"
                    placeholder="Describe el producto"
                    value={otherProduct}
                    onChange={(e) => setOtherProduct(e.target.value)}
                    className="h-11 md:h-10 text-base"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Block 3: Recipient */}
          <Card className="shadow-lg border-2 border-border/50 hover:border-primary/30 transition-all duration-300 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl">
                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                  <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <span>3. ¿A quién se lo llevamos?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4 px-4 md:px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="recipientName" className="text-sm md:text-base">Nombre del destinatario *</Label>
                  <Input
                    id="recipientName"
                    placeholder="María López"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="h-11 md:h-10 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="recipientPhone" className="text-sm md:text-base">Teléfono del destinatario *</Label>
                  <Input
                    id="recipientPhone"
                    type="tel"
                    placeholder="612 345 678"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="h-11 md:h-10 text-base"
                  />
                </div>
              </div>
              <AddressAutocomplete
                id="deliveryAddress"
                label="Dirección de entrega *"
                placeholder="C/ Ejemplo 45, 3º2ª, Barcelona"
                value={deliveryAddress}
                onChange={(v) => { setDeliveryAddress(v); setDeliveryLat(null); setDeliveryLng(null); setQuoteResult(null); }}
                onCoordinates={(lat, lng) => { setDeliveryLat(lat); setDeliveryLng(lng); }}
              />
            </CardContent>
          </Card>

          {/* Block 4: Schedule */}
          <Card className="shadow-lg border-2 border-border/50 hover:border-primary/30 transition-all duration-300 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border/50 py-3 md:py-4 px-4 md:px-6">
              <CardTitle className="flex items-center gap-2 md:gap-3 text-base md:text-xl">
                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                </div>
                <span>4. ¿Cuándo lo entreguemos?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4 px-4 md:px-6">
              <div>
                <Label htmlFor="timeSlot" className="text-sm md:text-base">Franja horaria deseada *</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger id="timeSlot" className="h-11 md:h-10 text-base">
                    <SelectValue placeholder="Selecciona la franja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lo-antes-posible">Lo antes posible (hoy)</SelectItem>
                    <SelectItem value="hoy-manana">Hoy por la mañana</SelectItem>
                    <SelectItem value="hoy-tarde">Hoy por la tarde</SelectItem>
                    <SelectItem value="fecha-concreta">Fecha y hora concretas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {timeSlot === "fecha-concreta" && (
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label htmlFor="specificDate" className="text-sm md:text-base">Fecha *</Label>
                    <Input
                      id="specificDate"
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                      className="h-11 md:h-10 text-base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="specificTime" className="text-sm md:text-base">Hora *</Label>
                    <Input
                      id="specificTime"
                      type="time"
                      value={specificTime}
                      onChange={(e) => setSpecificTime(e.target.value)}
                      className="h-11 md:h-10 text-base"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="notes" className="text-sm md:text-base">Notas para el repartidor (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Llamar al llegar, timbre 3º2ª"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Quote Button */}
          <div className="pt-2">
            <Button
              type="button"
              size="lg"
              onClick={handleGetQuote}
              disabled={isLoadingQuote || isLoadingCheckout}
              className="w-full font-bold text-base md:text-lg h-14 md:h-16 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-lg active:scale-[0.98]"
            >
              {isLoadingQuote ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Calculando precio…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Calcular precio
                </span>
              )}
            </Button>
          </div>

          {/* Quote Result */}
          {quoteResult?.ok && (
            <div id="quote-result">
              {quoteResult.manual_quote_required ? (
                /* Manual quote required */
                <Card className="border-2 border-orange-300 bg-orange-50 shadow-lg">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex gap-3 items-start">
                      <AlertTriangle className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-orange-800 text-base mb-1">
                          Presupuesto personalizado requerido
                        </p>
                        <p className="text-orange-700 text-sm">
                          Este servicio requiere presupuesto personalizado. Contacta con LocalXpress a través de nuestro canal de atención al cliente o{" "}
                          <a href="mailto:info@localxpress.es" className="underline hover:text-orange-900">info@localxpress.es</a>.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Quote success */
                <Card className="border-2 border-primary/40 shadow-lg overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border/50 py-3 px-4 md:px-6">
                    <CardTitle className="flex items-center gap-2 text-base md:text-lg text-foreground">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Calculator className="w-4 h-4 text-primary" />
                      </div>
                      Resumen de tu pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 pb-5 px-4 md:px-6 space-y-4">
                    {/* Addresses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="bg-muted/40 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Recogida</p>
                        <p className="text-foreground font-medium break-words">{pickupAddress}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Entrega</p>
                        <p className="text-foreground font-medium break-words">{deliveryAddress}</p>
                      </div>
                    </div>

                    {/* Order details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="text-center bg-muted/30 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Destinatario</p>
                        <p className="font-semibold text-foreground truncate">{recipientName}</p>
                      </div>
                      <div className="text-center bg-muted/30 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Paquete</p>
                        <p className="font-semibold text-foreground truncate">{PACKAGE_LABELS[productSize] ?? productSize}</p>
                      </div>
                      <div className="text-center bg-muted/30 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Distancia</p>
                        <p className="font-semibold text-foreground">{quoteResult.distance_km} km</p>
                        {quoteResult.duration_minutes != null && (
                          <p className="text-xs text-muted-foreground">{quoteResult.duration_minutes + SERVICE_TIME_BUFFER_MINUTES} min</p>
                        )}
                      </div>
                      <div className="text-center bg-muted/30 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-muted-foreground mb-1">Zona</p>
                        <p className="font-semibold text-foreground truncate">{quoteResult.zone_name}</p>
                      </div>
                    </div>

                    {/* Price + pay button */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2 border-t border-border/50">
                      <div>
                        <p className="text-xs text-muted-foreground">Importe total</p>
                        <p className="text-4xl font-bold text-primary">{quoteResult.price} €</p>
                        {quoteResult.distance_source === "mock" && (
                          <p className="text-xs text-orange-500 mt-0.5">
                            * Distancia aproximada (modo desarrollo)
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleCheckout}
                        disabled={isLoadingCheckout}
                        className="w-full md:w-auto font-bold text-base h-14 md:h-12 px-8 bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-md active:scale-[0.98]"
                      >
                        {isLoadingCheckout ? (
                          <span className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Redirigiendo…
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Pagar ahora
                          </span>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
};

export default Index;
