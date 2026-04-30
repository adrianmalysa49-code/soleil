export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:adrianmalysa49@gmail.com';
  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Brak konfiguracji VAPID' });
  }

  // Pobierz wszystkie subskrypcje — premium najpierw
  const subsRes = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?order=created_at.asc`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const subscriptions = await subsRes.json();

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({ sent: 0, message: 'Brak subskrypcji' });
  }

  // Pobierz premium użytkowników
  const premRes = await fetch(
    `${supabaseUrl}/rest/v1/user_subscriptions?is_premium=eq.true`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const premiumUsers = await premRes.json();
  const premiumIds = new Set((premiumUsers || []).map(u => u.user_id));

  // Wiadomości powiadomień
  const messages = [
    'Hej, jak minął Ci dzień? Jestem tu dla Ciebie. 🌸',
    'Jak się czujesz dziś wieczorem? Chętnie posłucham. 💛',
    'Masz chwilę? Opowiedz mi jak dzisiaj było. ☀️',
    'Pamiętam o Tobie. Jak Twój dzień? 🌻',
    'Wieczór to dobry czas żeby się zatrzymać. Jak się czujesz? 🌙',
  ];
  const randomMsg = messages[Math.floor(Math.random() * messages.length)];

  const premiumMessages = [
    'Hej, zauważyłem/am że jakiś czas minął od naszej ostatniej rozmowy. Jak się miewasz? ✨',
    'Wieczorna chwila dla siebie — co dziś przeżyłeś/aś? Jestem tu. 💜',
    'Czas na chwilę refleksji. Jak minął Ci dzień? Chętnie porozmawiam. 🌟',
  ];
  const premiumMsg = premiumMessages[Math.floor(Math.random() * premiumMessages.length)];

  let sent = 0;
  const failed = [];

  for (const sub of subscriptions) {
    const isPremium = premiumIds.has(sub.user_id);
    const body = isPremium ? premiumMsg : randomMsg;
    const title = isPremium ? 'Soleil Premium ✨' : 'Soleil ☀️';

    const payload = JSON.stringify({ title, body, url: '/' });

    try {
      const subscription = sub.subscription;

      // Buduj VAPID JWT
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 12 * 60 * 60;
      const origin = new URL(subscription.endpoint).origin;

      const headerB64 = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify({ aud: origin, exp, sub: vapidEmail })).toString('base64url');
      const unsignedToken = `${headerB64}.${payloadB64}`;
      const authHeader2 = `vapid t=${unsignedToken},k=${vapidPublic}`;

      const pushRes = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Authorization': authHeader2,
          'TTL': '86400'
        },
        body: Buffer.from(payload)
      });

      if (pushRes.status === 201 || pushRes.status === 200 || pushRes.status === 202) {
        sent++;
      } else if (pushRes.status === 410 || pushRes.status === 404) {
        failed.push(sub.user_id);
      }
    } catch (err) {
      console.error('Push error:', err.message);
    }
  }

  // Usuń wygasłe subskrypcje
  for (const uid of failed) {
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${uid}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
  }

  return res.status(200).json({ sent, failed: failed.length, total: subscriptions.length });
}
