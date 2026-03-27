export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda niedozwolona' });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!stripeSecretKey || !priceId) {
    return res.status(500).json({ error: 'Brak konfiguracji Stripe' });
  }

  const { userId, userEmail } = req.body;
  if (!userId) return res.status(400).json({ error: 'Brak userId' });

  try {
    // Utwórz sesję checkout w Stripe
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'mode': 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'success_url': `${req.headers.origin}?premium=success`,
        'cancel_url': `${req.headers.origin}?premium=cancel`,
        'customer_email': userEmail || '',
        'metadata[user_id]': userId,
        'allow_promotion_codes': 'true'
      })
    });

    const session = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: session.error?.message || 'Błąd Stripe' });
    }

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
}
