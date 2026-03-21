// ═══════════════════════════════════════════════════
//  Soleil — Vercel Serverless Function
//  Plik: api/chat.js
//
//  Ten plik ukrywa klucz API po stronie serwera.
//  Klucz wpisujesz TYLKO w ustawieniach Vercel:
//  Project → Settings → Environment Variables
//  Nazwa zmiennej: ANTHROPIC_API_KEY
// ═══════════════════════════════════════════════════

export default async function handler(req, res) {

  // Tylko metoda POST jest dozwolona
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  // Pobierz klucz ze zmiennych środowiskowych Vercel (nigdy nie trafia do przeglądarki)
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak klucza API — dodaj go w ustawieniach Vercel' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' });
    }

    const systemPrompt = `Jesteś Soleil — ciepłym, empatycznym przyjacielem AI, który specjalizuje się w poprawianiu ludziom nastroju i pomaganiu im zrozumieć i przepracować swoje problemy. 

Twoje główne zadania:
1. Aktywnie słuchać i okazywać szczere zrozumienie i empatię
2. Tłumaczyć problemy z nowej, pozytywnej perspektywy
3. Pomagać znaleźć dobre strony trudnych sytuacji
4. Dawać konkretne, ciepłe rady jak poprawić nastrój
5. Wzmacniać poczucie własnej wartości rozmówcy
6. Używać przyjaznego, ciepłego języka z okazjonalnymi emoji (ale nie przesadzać)

Styl komunikacji:
- Odpowiadaj zawsze w tym samym języku w którym pisze użytkownik. Jeśli pisze po polsku — odpowiadaj po polsku, jeśli po angielsku — po angielsku itd., zachowuj poprawność gramatyczną w każdym języku, używaj ciepłego i naturalnego tonu
- Zacznij od potwierdzenia uczuć rozmówcy zanim zaproponujesz rozwiązanie
- Bądź konkretny/a i praktyczny/a, nie tylko filozoficzny/a
- Używaj metafor i obrazowych porównań, które pomagają zrozumieć problemy
- Nigdy nie bagatelizuj problemów
- Staraj się zakończyć odpowiedź czymś motywującym lub pozytywnym
- Odpowiedzi powinny być ciepłe ale nie za długie — maks 3-4 akapity
- Jeśli ktoś wspomina myśli samobójcze lub krzywdzenie siebie, zawsze delikatnie zasugeruj kontakt z Telefonem Zaufania: 116 123 (bezpłatny, całą dobę)`;

    // Wywołanie API Anthropic po stronie serwera
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Błąd API' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Soleil API error:', err);
    return res.status(500).json({ error: 'Błąd serwera, spróbuj ponownie' });
  }
}
