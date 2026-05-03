import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PickupRequest {
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  pickupAddress: string;
  productType: string;
  productSize: string;
  isFragile: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  timeSlot: string;
  specificDate?: string;
  specificTime?: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PickupRequest = await req.json();
    console.log("Processing pickup request:", data);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Build email HTML content
    const emailHtml = `
      <h1>Nueva Solicitud de Recogida - LocalXpress</h1>
      
      <h2>📍 Datos de quien solicita la recogida</h2>
      <ul>
        <li><strong>Nombre:</strong> ${data.senderName}</li>
        <li><strong>Teléfono:</strong> ${data.senderPhone}</li>
        <li><strong>Correo:</strong> ${data.senderEmail}</li>
        <li><strong>Dirección de recogida:</strong> ${data.pickupAddress}</li>
      </ul>

      <h2>📦 Producto a Entregar</h2>
      <ul>
        <li><strong>Tipo de producto:</strong> ${data.productType}</li>
        <li><strong>Tamaño:</strong> ${data.productSize}</li>
        <li><strong>¿Es frágil?:</strong> ${data.isFragile}</li>
      </ul>

      <h2>👤 Destinatario (Entrega)</h2>
      <ul>
        <li><strong>Nombre:</strong> ${data.recipientName}</li>
        <li><strong>Teléfono:</strong> ${data.recipientPhone}</li>
        <li><strong>Dirección de entrega:</strong> ${data.deliveryAddress}</li>
      </ul>

      <h2>⏰ Horario</h2>
      <ul>
        <li><strong>Franja horaria:</strong> ${data.timeSlot}</li>
        ${data.specificDate ? `<li><strong>Fecha específica:</strong> ${data.specificDate}</li>` : ''}
        ${data.specificTime ? `<li><strong>Hora específica:</strong> ${data.specificTime}</li>` : ''}
      </ul>

      ${data.notes ? `
      <h2>📝 Notas para el Repartidor</h2>
      <p>${data.notes}</p>
      ` : ''}

      <hr />
      <p style="color: #666; font-size: 12px;">Este correo fue enviado automáticamente desde el formulario de LocalXpress</p>
    `;

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LocalXpress <onboarding@resend.dev>",
        to: ["robertogarcia2772@gmail.com"],
        subject: `Nueva Solicitud de Recogida - ${data.senderName}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, message: "Solicitud enviada correctamente" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-pickup-request function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
