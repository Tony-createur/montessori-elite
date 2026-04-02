const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature =
    event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Signature Stripe invalide :", err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`
    };
  }

  try {
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const customerEmail =
        session.customer_details?.email ||
        session.customer_email ||
        null;

      if (!customerEmail) {
        console.log("Aucun email trouvé.");
        return {
          statusCode: 200,
          body: JSON.stringify({ received: true, skipped: "no_email" })
        };
      }

      const accessUrl =
        process.env.ELITE_ACCESS_URL ||
        "https://montessori-elite.fr/acces-elite-9847.html";

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;">
          <h2 style="margin-bottom:16px;">Bienvenue dans Montessori Elite Premium</h2>
          <p>Merci pour votre paiement.</p>
          <p>Voici votre lien d’accès premium :</p>
          <p style="margin:24px 0;">
            <a href="${accessUrl}" style="display:inline-block;padding:12px 20px;background:#222;color:#fff;text-decoration:none;border-radius:8px;">
              Accéder à mon espace Premium
            </a>
          </p>
          <p>Ou copiez ce lien :</p>
          <p><a href="${accessUrl}">${accessUrl}</a></p>
          <p style="margin-top:24px;">Belle découverte à vous 🌿</p>
        </div>
      `;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL,
          to: [customerEmail],
          subject: "Votre accès Montessori Elite Premium",
          html: html
        })
      });

      const resendData = await resendResponse.json();

      if (!resendResponse.ok) {
        console.error("Erreur Resend :", resendData);
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: "email_send_failed",
            details: resendData
          })
        };
      }

      console.log("Email envoyé à :", customerEmail);

      return {
        statusCode: 200,
        body: JSON.stringify({
          received: true,
          emailed: true,
          email: customerEmail
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        received: true,
        ignored: stripeEvent.type
      })
    };
  } catch (err) {
    console.error("Erreur interne :", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "internal_error",
        message: err.message
      })
    };
  }
};
