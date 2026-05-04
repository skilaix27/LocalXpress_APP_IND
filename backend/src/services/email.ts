import { Resend } from "resend";
import type { PaidOrder } from "./orders";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailResult {
  ok: boolean;
  error?: string;
}

// ─── Resend client (lazy singleton) ──────────────────────────────────────────

let _resend: Resend | null = null;

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend is not configured");
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

function checkResendConfig(): string | null {
  if (!process.env.RESEND_API_KEY) return "Resend is not configured";
  return null;
}

function fromAddress(): string {
  return process.env.RESEND_FROM || "LocalXpress <onboarding@resend.dev>";
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const PACKAGE_LABELS: Record<string, string> = {
  small:    "Pequeño",
  medium:   "Mediano",
  large:    "Grande",
  delicate: "Delicado",
};

function pkg(size: string): string {
  return PACKAGE_LABELS[size] ?? size;
}

function displayCode(order: PaidOrder): string {
  return order.central_order_code || order.order_code;
}

function fmtDate(dateStr: string): string {
  const p = dateStr.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dateStr;
}

// ─── Unified support footer ───────────────────────────────────────────────────

function getEmailFooterHtml(): string {
  return `
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px 0;">
  <p style="font-size:12px;line-height:18px;color:#6b7280;margin:0;">
    Si tienes cualquier incidencia, duda o problema relacionado con este servicio,
    puedes contactar con nuestro equipo de soporte escribiendo a
    <a href="mailto:incidencias@localxpress.es" style="color:#f97316;text-decoration:none;">incidencias@localxpress.es</a>
    o llamando al
    <a href="tel:+34711225793" style="color:#f97316;text-decoration:none;">+34 711 22 57 93</a>.
  </p>
  <p style="font-size:11px;line-height:16px;color:#9ca3af;margin:10px 0 0 0;">
    LocalXpress · Gestión logística de última milla en Barcelona
  </p>`;
}

function getEmailFooterText(): string {
  return [
    ``,
    `---`,
    `Si tienes cualquier incidencia, duda o problema relacionado con este servicio, puedes contactar con nuestro equipo de soporte escribiendo a incidencias@localxpress.es o llamando al +34 711 22 57 93.`,
    ``,
    `LocalXpress · Gestión logística de última milla en Barcelona`,
  ].join("\n");
}

// ─── Admin email ──────────────────────────────────────────────────────────────

function adminHtml(o: PaidOrder): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo pedido - LocalXpress</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#111827;font-size:14px;line-height:1.6;">

  <p style="margin:0 0 2px 0;font-size:18px;font-weight:bold;color:#f97316;">Nuevo pedido pagado — LocalXpress</p>
  <p style="margin:0 0 20px 0;font-size:16px;">
    <strong>${displayCode(o)}</strong> &nbsp;·&nbsp; <strong>${o.price !== null ? o.price + " &#8364;" : "Presupuesto personalizado"}</strong>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;">

  <p style="margin:0 0 4px 0;font-weight:bold;">Cliente que solicita</p>
  <p style="margin:0 0 16px 0;">
    Nombre: ${o.customer_full_name ?? "No indicado"}<br>
    Teléfono: ${o.customer_phone ?? "No indicado"}<br>
    Email: ${o.customer_email}
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;">

  <p style="margin:0 0 4px 0;font-weight:bold;">Destinatario</p>
  <p style="margin:0 0 16px 0;">
    Nombre: ${o.client_name}<br>
    Teléfono: ${o.client_phone}
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;">

  <p style="margin:0 0 4px 0;font-weight:bold;">Servicio</p>
  <p style="margin:0 0 16px 0;">
    Recogida: ${o.pickup_address}<br>
    Entrega: ${o.delivery_address}<br>
    Fecha: ${fmtDate(o.scheduled_date)}<br>
    Hora: ${o.scheduled_time}<br>
    Paquete: ${pkg(o.package_size)}<br>
    Notas: ${o.client_notes || "Sin notas"}
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;">

  <p style="margin:0 0 4px 0;font-weight:bold;">Ruta</p>
  <p style="margin:0 0 16px 0;">
    Distancia: ${o.distance_km} km<br>
    Duración: ${o.duration_minutes !== null ? o.duration_minutes + " min" : "&#8212;"}<br>
    Zona: ${o.zone_name}
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;">

  <p style="margin:0 0 4px 0;font-weight:bold;">Pago (Stripe)</p>
  <p style="margin:0 0 0 0;word-break:break-all;">
    Session: ${o.stripe_checkout_session_id}<br>
    Payment intent: ${o.stripe_payment_intent_id}
  </p>

  ${getEmailFooterHtml()}

</body>
</html>`;
}

function adminText(o: PaidOrder): string {
  return [
    `Nuevo pedido pagado — LocalXpress`,
    `Código: ${displayCode(o)}  ·  Precio: ${o.price !== null ? o.price + " €" : "Presupuesto personalizado"}`,
    ``,
    `CLIENTE QUE SOLICITA`,
    `Nombre: ${o.customer_full_name ?? "No indicado"}`,
    `Teléfono: ${o.customer_phone ?? "No indicado"}`,
    `Email: ${o.customer_email}`,
    ``,
    `DESTINATARIO`,
    `Nombre: ${o.client_name}`,
    `Teléfono: ${o.client_phone}`,
    ``,
    `SERVICIO`,
    `Recogida: ${o.pickup_address}`,
    `Entrega: ${o.delivery_address}`,
    `Fecha: ${fmtDate(o.scheduled_date)}`,
    `Hora: ${o.scheduled_time}`,
    `Paquete: ${pkg(o.package_size)}`,
    `Notas: ${o.client_notes || "Sin notas"}`,
    ``,
    `RUTA`,
    `Distancia: ${o.distance_km} km`,
    `Duración: ${o.duration_minutes !== null ? o.duration_minutes + " min" : "—"}`,
    `Zona: ${o.zone_name}`,
    ``,
    `PAGO (STRIPE)`,
    `Session: ${o.stripe_checkout_session_id}`,
    `Payment intent: ${o.stripe_payment_intent_id}`,
    getEmailFooterText(),
  ].join("\n");
}

// ─── Customer confirmation email ──────────────────────────────────────────────

function customerHtml(o: PaidOrder): string {
  const code = displayCode(o);
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Pedido LocalXpress confirmado</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 16px;color:#111827;font-size:14px;line-height:1.6;">

  <p style="margin:0 0 16px 0;">Hola, <strong>${o.customer_full_name ?? o.client_name}</strong></p>

  <p style="margin:0 0 8px 0;">
    Hemos recibido correctamente tu solicitud de envío y el pago se ha confirmado con éxito.
  </p>
  <p style="margin:0 0 20px 0;">
    Nuestro equipo gestionará el servicio según la fecha y hora seleccionadas.
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;">

  <p style="margin:0 0 4px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Código de pedido</p>
  <p style="margin:0 0 20px 0;font-size:20px;font-weight:bold;font-family:monospace;letter-spacing:0.05em;color:#111827;">${code}</p>

  <p style="margin:0 0 4px 0;font-weight:bold;">Detalles del servicio</p>
  <p style="margin:0 0 16px 0;">
    Fecha del servicio: ${fmtDate(o.scheduled_date)} a las ${o.scheduled_time}<br>
    Recogida: ${o.pickup_address}<br>
    Entrega: ${o.delivery_address}<br>
    Destinatario: ${o.client_name}<br>
    Teléfono destinatario: ${o.client_phone}<br>
    Tipo de paquete: ${pkg(o.package_size)}<br>
    Precio pagado: <strong>${o.price !== null ? o.price + " &#8364;" : "Presupuesto personalizado"}</strong>
  </p>

  <p style="margin:0 0 20px 0;">Gracias por confiar en LocalXpress.</p>

  ${getEmailFooterHtml()}

</body>
</html>`;
}

function customerText(o: PaidOrder): string {
  const code = displayCode(o);
  return [
    `Hola, ${o.customer_full_name ?? o.client_name}`,
    ``,
    `Hemos recibido correctamente tu solicitud de envío y el pago se ha confirmado con éxito.`,
    `Nuestro equipo gestionará el servicio según la fecha y hora seleccionadas.`,
    ``,
    `Código de pedido: ${code}`,
    ``,
    `Fecha del servicio: ${fmtDate(o.scheduled_date)} a las ${o.scheduled_time}`,
    `Recogida: ${o.pickup_address}`,
    `Entrega: ${o.delivery_address}`,
    `Destinatario: ${o.client_name}`,
    `Teléfono destinatario: ${o.client_phone}`,
    `Tipo de paquete: ${pkg(o.package_size)}`,
    `Precio pagado: ${o.price !== null ? o.price + " €" : "Presupuesto personalizado"}`,
    ``,
    `Gracias por confiar en LocalXpress.`,
    getEmailFooterText(),
  ].join("\n");
}

// ─── Public functions ─────────────────────────────────────────────────────────

export async function sendAdminOrderEmail(order: PaidOrder): Promise<EmailResult> {
  const configError = checkResendConfig();
  if (configError) {
    console.warn("[email] sendAdminOrderEmail skipped:", configError);
    return { ok: false, error: configError };
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn("[email] sendAdminOrderEmail skipped: ADMIN_EMAIL is not configured");
    return { ok: false, error: "ADMIN_EMAIL is not configured" };
  }

  try {
    const { error } = await getResend().emails.send({
      from:    fromAddress(),
      to:      adminEmail,
      subject: `Nuevo pedido particular pagado - LocalXpress [${displayCode(order)}]`,
      html:    adminHtml(order),
      text:    adminText(order),
    });

    if (error) {
      console.error("[email] Resend admin error:", error.message);
      return { ok: false, error: "Failed to send admin notification email." };
    }

    console.log(`[email] Admin notified — ${order.order_code}`);
    return { ok: true };
  } catch (err: unknown) {
    console.error("[email] sendAdminOrderEmail threw:", (err as Error).message);
    return { ok: false, error: "Failed to send admin notification email." };
  }
}

export async function sendCustomerConfirmationEmail(order: PaidOrder): Promise<EmailResult> {
  const configError = checkResendConfig();
  if (configError) {
    console.warn("[email] sendCustomerConfirmationEmail skipped:", configError);
    return { ok: false, error: configError };
  }

  try {
    const { error } = await getResend().emails.send({
      from:    fromAddress(),
      to:      order.customer_email,
      subject: `Pedido LocalXpress confirmado · ${displayCode(order)}`,
      html:    customerHtml(order),
      text:    customerText(order),
    });

    if (error) {
      console.error("[email] Resend customer error:", error.message);
      return { ok: false, error: "Failed to send customer confirmation email." };
    }

    console.log(`[email] Customer confirmation sent to ${order.customer_email} (${order.order_code})`);
    return { ok: true };
  } catch (err: unknown) {
    console.error("[email] sendCustomerConfirmationEmail threw:", (err as Error).message);
    return { ok: false, error: "Failed to send customer confirmation email." };
  }
}
